import type { ActionDescriptor } from "../game/ActionRegistry";
import type { GameContext } from "../game/GameContextStore";
import { GameEngine, type ActionSource } from "../game/GameEngine";
import { ENGINE_EVENTS } from "../game/EngineEvents";
import type { HandCardView } from "../ui/HandTypes";
import { HandPresenter } from "../ui/HandPresenter";
import type { SlotViewModel } from "../ui/SlotTypes";
import { SlotPresenter } from "../ui/SlotPresenter";
import { ApiManager } from "../api/ApiManager";
import type { EffectTargetController } from "./EffectTargetController";
import { AttackTargetCoordinator } from "./AttackTargetCoordinator";
import { BlockerFlowManager } from "./BlockerFlowManager";
import { ActionBarCoordinator } from "./ActionBarCoordinator";
import { SelectionHandler } from "./SelectionHandler";
import { ActionExecutor } from "./ActionExecutor";
import { TurnStateCoordinator } from "./TurnStateCoordinator";
import { OpponentResolver } from "./OpponentResolver";
import { ActionStepTriggerHandler } from "./ActionStepTriggerHandler";
import type { ActionControls, SlotControls } from "./ControllerTypes";
import { SlotInteractionGate } from "./SlotInteractionGate";
import { ActionStepCoordinator } from "./ActionStepCoordinator";
import { AbilityActivationFlowController } from "./AbilityActivationFlowController";
import { createLogger } from "../utils/logger";

type HandControls = {
  setHand: (cards: HandCardView[], opts?: { preserveSelectionUid?: string }) => void;
  clearSelection?: () => void;
};

export type SelectionActionControllerDeps = {
  engine: GameEngine;
  slotPresenter: SlotPresenter;
  handPresenter: HandPresenter;
  api: ApiManager;
  handControls?: HandControls | null;
  slotControls?: SlotControls | null;
  actionControls?: ActionControls | null;
  effectTargetController?: EffectTargetController | null;
  gameContext: GameContext;
  refreshPhase: (skipFade: boolean) => void;
  showOverlay?: (message: string, slot?: SlotViewModel) => void;
  onPlayerAction?: (actionId: string) => void;
  shouldDelayActionBar?: (raw: any) => boolean;
  onDelayActionBar?: (raw: any) => void;
  abilityChoiceDialog?: import("../ui/AbilityChoiceDialog").AbilityChoiceDialog | null;
  burstChoiceDialog?: import("../ui/BurstChoiceDialog").BurstChoiceDialog | null;
  onTimerPause?: () => void;
  onTimerResume?: () => void;
  burstFlow?: import("./BurstChoiceFlowManager").BurstChoiceFlowManager;
};

export type SelectionActionControllerModules = {
  slotGate: SlotInteractionGate;
  attackCoordinator: AttackTargetCoordinator;
  blockerFlow: BlockerFlowManager;
  burstFlow: import("./BurstChoiceFlowManager").BurstChoiceFlowManager;
  actionStepCoordinator: ActionStepCoordinator;
  abilityFlow: AbilityActivationFlowController;
  selectionHandler: SelectionHandler;
  opponentResolver: OpponentResolver;
  actionExecutor: ActionExecutor;
  actionStepTriggerHandler: ActionStepTriggerHandler;
  turnStateCoordinator: TurnStateCoordinator;
  actionBarCoordinator: ActionBarCoordinator;
};

export class SelectionActionController {
  private readonly log = createLogger("SelectionAction");
  private slotControls?: SlotControls | null;
  private slotGate: SlotInteractionGate;
  private attackCoordinator: AttackTargetCoordinator;
  private blockerFlow: BlockerFlowManager;
  private actionStepCoordinator: ActionStepCoordinator;
  private actionBarCoordinator: ActionBarCoordinator;
  private abilityFlow: AbilityActivationFlowController;
  private selectionHandler: SelectionHandler;
  private actionExecutor: ActionExecutor;
  private turnStateCoordinator: TurnStateCoordinator;
  private opponentResolver: OpponentResolver;
  private actionStepTriggerHandler: ActionStepTriggerHandler;

  constructor(
    private deps: SelectionActionControllerDeps,
    modules: SelectionActionControllerModules,
  ) {
    // React to battle state changes emitted by the engine instead of re-parsing snapshots everywhere.
    this.deps.engine.events.on(ENGINE_EVENTS.BATTLE_STATE_CHANGED, (payload: { active: boolean; status: string }) => {
      this.handleBattleStateChanged(payload);
    });
    this.slotControls = this.deps.slotControls;
    this.slotGate = modules.slotGate;
    this.attackCoordinator = modules.attackCoordinator;
    this.blockerFlow = modules.blockerFlow;
    this.actionStepCoordinator = modules.actionStepCoordinator;
    this.abilityFlow = modules.abilityFlow;
    this.selectionHandler = modules.selectionHandler;
    this.opponentResolver = modules.opponentResolver;
    this.actionExecutor = modules.actionExecutor;
    this.actionStepTriggerHandler = modules.actionStepTriggerHandler;
    this.turnStateCoordinator = modules.turnStateCoordinator;
    this.actionBarCoordinator = modules.actionBarCoordinator;
  }

  getSelectedHandCard() {
    return this.selectionHandler.getSelectedHandCard();
  }

  handleHandCardSelected(card: HandCardView) {
    this.selectionHandler.handleHandCardSelected(card);
  }

  async handleSlotCardSelected(slot: SlotViewModel) {
    await this.selectionHandler.handleSlotCardSelected(slot);
  }

  handleBaseCardSelected(payload?: { side: "opponent" | "player"; card?: any }) {
    this.selectionHandler.handleBaseCardSelected(payload);
  }

  refreshActions(source: ActionSource = "neutral") {
    const snapshotRaw = this.deps.engine.getSnapshot().raw as any;
    if (this.deps.shouldDelayActionBar?.(snapshotRaw)) {
      this.deps.onDelayActionBar?.(snapshotRaw);
      return;
    }
    this.syncAndUpdateActionBar(source);
  }

  refreshAfterStateChange(actionSource: ActionSource = "neutral") {
    this.deps.refreshPhase(true);
    this.refreshActions(actionSource);
  }

  async runActionThenRefresh(actionId: string, actionSource: ActionSource = "neutral") {
    // Slot-specific actions are handled directly to avoid engine placeholders.
    if (actionId === "attackUnit") {
      await this.actionExecutor.handleAttackUnit();
      this.deps.onPlayerAction?.(actionId);
      return;
    }
    if (actionId === "attackShieldArea") {
      await this.actionExecutor.handleAttackShieldArea();
      this.deps.onPlayerAction?.(actionId);
      return;
    }
    if (actionId === "skipAction") {
      await this.actionExecutor.handleSkipAction();
      this.deps.onPlayerAction?.(actionId);
      return;
    }
    if (actionId === "activateEffect") {
      const rawSnapshot: any = this.deps.engine.getSnapshot().raw;
      const selectionSnapshot: any = this.deps.engine.getSelection();
      await this.abilityFlow.showAbilityChoiceDialog({ raw: rawSnapshot, selection: selectionSnapshot });
      // Reset selection + action bar to defaults while the dialog is open.
      this.selectionHandler.clearSelectionUI({ clearEngine: true });
      this.refreshActions("neutral");
      return;
    }
    if (actionId === "cancelSelection") {
      this.actionExecutor.cancelSelection();
      return;
    }
    this.log.debug("runActionThenRefresh");
    const result = await this.deps.engine.runAction(actionId);
    if (result === false) return;
    this.deps.onPlayerAction?.(actionId);
    this.refreshAfterStateChange(actionSource);
  }

  updateActionBarForPhase(raw: any, opts: { isSelfTurn: boolean }) {
    this.syncAndUpdateActionBar("neutral", raw, { isSelfTurn: opts.isSelfTurn });
  }

  clearSelectionUI(opts: { clearEngine?: boolean } = {}) {
    this.selectionHandler.clearSelectionUI(opts);
  }

  buildActionDescriptors(descriptors: ActionDescriptor[]) {
    return descriptors.map((d) => ({
      label: d.label,
      enabled: d.enabled,
      primary: d.primary,
      onClick: async () => {
        await this.runActionThenRefresh(d.id, "neutral");
      },
    }));
  }

  private handleBattleStateChanged(payload: { active: boolean; status: string }) {
    this.actionBarCoordinator.handleBattleStateChanged(payload);
  }

  private async handleActionStepTrigger(selection: any) {
    await this.actionStepTriggerHandler.handleActionStepTrigger(selection);
  }

  private async handlePilotEffectTrigger(slot?: SlotViewModel) {
    await this.actionStepTriggerHandler.handlePilotEffectTrigger(slot);
  }

  private async handleUnitEffectTrigger(slot?: SlotViewModel) {
    await this.actionStepTriggerHandler.handleUnitEffectTrigger(slot);
  }


  private syncSnapshotState(raw: any, opts: { isSelfTurn?: boolean } = {}) {
    // eslint-disable-next-line no-console
    this.log.debug("syncSnapshotState", {
      hasRaw: Boolean(raw),
      isSelfTurn: opts.isSelfTurn,
      currentPlayer: raw?.gameEnv?.currentPlayer ?? raw?.currentPlayer,
    });
    this.turnStateCoordinator.syncSnapshotState(raw, opts);
  }

  syncAndUpdateActionBar(source: ActionSource, raw?: any, opts: { isSelfTurn?: boolean } = {}) {
    const snapshotRaw = raw ?? (this.deps.engine.getSnapshot().raw as any);
    this.syncSnapshotState(snapshotRaw, opts);
    if (this.deps.shouldDelayActionBar?.(snapshotRaw)) {
      this.deps.onDelayActionBar?.(snapshotRaw);
      return;
    }
    this.actionBarCoordinator.updateActionBarState(snapshotRaw, { source });
  }

}
