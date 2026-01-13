import type { ActionDescriptor } from "../game/ActionRegistry";
import type { ActionSource, GameEngine } from "../game/GameEngine";
import type { GameContext } from "../game/GameContextStore";
import type { HandCardView } from "../ui/HandTypes";
import type { HandPresenter } from "../ui/HandPresenter";
import type { SlotViewModel } from "../ui/SlotTypes";
import type { ActionControls } from "./ControllerTypes";
import type { AttackTargetCoordinator } from "./AttackTargetCoordinator";
import type { BlockerFlowManager } from "./BlockerFlowManager";
import type { ActionStepCoordinator } from "./ActionStepCoordinator";
import { buildSlotActionDescriptors, getPhase, isMainPhase, isPlayersTurn } from "./actionBarRules";
import { computeActionBarDecision, computeMainPhaseState, computeSlotActionState } from "./actionBarState";

type HandControls = {
  setHand: (cards: HandCardView[], opts?: { preserveSelectionUid?: string }) => void;
};

export class ActionBarCoordinator {
  private lastPhase?: string;
  private lastBattleActive = false;
  private lastBattleStatus?: string;

  constructor(
    private deps: {
      engine: GameEngine;
      handPresenter: HandPresenter;
      actionControls?: ActionControls | null;
      handControls?: HandControls | null;
      gameContext: GameContext;
      actionStepCoordinator: ActionStepCoordinator;
      attackCoordinator: AttackTargetCoordinator;
      blockerFlow: BlockerFlowManager;
      getSelection: () => any;
      getSelectedSlot: () => SlotViewModel | undefined;
      getOpponentRestedUnitSlots: () => SlotViewModel[];
      onAttackUnit: () => Promise<void>;
      onAttackShieldArea: () => Promise<void>;
      onCancelSelection: () => void;
      onRefreshActions: (source: ActionSource) => void;
      onSyncAndUpdateActionBar: (source: ActionSource) => void;
      buildActionDescriptors: (descriptors: ActionDescriptor[]) => Array<{
        label: string;
        enabled?: boolean;
        primary?: boolean;
        onClick?: () => Promise<void> | void;
      }>;
    },
  ) {}

  updateActionBarState(raw: any, opts: { source: ActionSource; selection?: any } = { source: "neutral" }) {
    const actions = this.deps.actionControls;
    if (!raw || !actions) return;
    const selection = opts.selection ?? this.deps.getSelection();
    const isSelfTurn = isPlayersTurn(raw, this.deps.gameContext.playerId);
    const isOpponentTurn = !isSelfTurn;
    const actionStepStatus = this.deps.actionStepCoordinator.getStatus(raw);
    const phase = getPhase(raw);

    // Decision map (phase x turn):
    // Main Phase: opponent -> waiting, self -> existing defaults.
    // Blocker Flow: opponent/self -> existing blocker buttons (always wins).
    // Action Step (opponent):
    //   confirmations[currentPlayer] === false -> allow targets/actions.
    //   confirmations[currentPlayer] === true -> waiting.
    // Action Step (self): follow existing action-step logic.
    // Step 0: Start-game waiting message for both players.
    const decision = computeActionBarDecision({
      phase,
      isSelfTurn,
      actionStepStatus,
      blockerActive: this.deps.blockerFlow.isActive(),
      isBlockerPhase: phase === "BLOCKER_PHASE",
    });

    if (decision.kind === "waiting") {
      this.applyWaitingState(actions, decision.label);
      return;
    }

    if (decision.kind === "blocker") {
      if (this.deps.blockerFlow.applyActionBar()) {
        return;
      }
    }

    if (decision.kind === "actionStep") {
      if (decision.isOpponentTurn) {
        this.deps.actionStepCoordinator.applyActionBar(selection, actionStepStatus);
        return;
      }
      actions.setWaitingForOpponent?.(false);
      this.deps.actionStepCoordinator.applyActionBar(selection, actionStepStatus);
      return;
    }

    // Main phase handling.
    actions.setWaitingForOpponent?.(false);
    if (this.deps.attackCoordinator.applyActionBar()) return;
    if (this.tryApplySlotActions(selection)) return;
    this.applyMainPhaseDefaults(raw, selection, opts.source);
  }

  handleBattleStateChanged(payload: { active: boolean; status: string }) {
    const status = (payload.status || "").toUpperCase();
    if (payload.active === this.lastBattleActive && status === (this.lastBattleStatus || "").toUpperCase()) {
      return;
    }
    const wasActive = this.lastBattleActive;
    this.lastBattleActive = payload.active;
    this.lastBattleStatus = payload.status;
    if (payload.active && status === "ACTION_STEP") {
      this.deps.onSyncAndUpdateActionBar("neutral");
    } else if (wasActive && !payload.active) {
      this.deps.onRefreshActions("neutral");
    }
  }

  private applyMainPhaseDefaults(raw: any, selection: any, source: ActionSource) {
    const actions = this.deps.actionControls;
    if (!raw || !actions) return;
    const phase = raw?.gameEnv?.phase;
    const self = this.deps.gameContext.playerId;
    const inMainPhase = isMainPhase(raw, self);
    if (!inMainPhase) {
      this.lastPhase = phase;
      this.lastBattleActive = false;
      return;
    }
    const battleActive = this.hasActiveBattle();
    const selectedSource = selection?.kind as ActionSource | undefined;
    const mainPhaseState = computeMainPhaseState({
      phase,
      selection,
      source,
      battleActive,
      lastPhase: this.lastPhase,
      lastBattleActive: this.lastBattleActive,
      defaultActions: this.deps.engine.getAvailableActions(source),
      selectedActions: selectedSource ? this.deps.engine.getAvailableActions(selectedSource) : [],
    });
    this.lastPhase = mainPhaseState.lastPhase;
    this.lastBattleActive = mainPhaseState.lastBattleActive;
    if (!mainPhaseState.shouldUpdate || !mainPhaseState.descriptors) return;
    actions.setState?.({
      descriptors: this.deps.buildActionDescriptors(mainPhaseState.descriptors),
    });
    if (mainPhaseState.setHand) {
      this.deps.handControls?.setHand?.(this.deps.handPresenter.toHandCards(raw, self));
    }
  }

  private hasActiveBattle() {
    const raw: any = this.deps.engine.getSnapshot().raw;
    const battle = raw?.gameEnv?.currentBattle ?? raw?.gameEnv?.currentbattle;
    return !!battle;
  }

  private applyWaitingState(actions: ActionControls, label: string) {
    actions.setWaitingLabel?.(label);
    actions.setWaitingForOpponent?.(true);
    actions.setState?.({ descriptors: [] });
  }

  private tryApplySlotActions(selection?: any) {
    const selectedSlot = this.deps.getSelectedSlot();
    const slotState = computeSlotActionState({
      selection,
      opponentHasUnit: this.deps.getOpponentRestedUnitSlots().length > 0,
      attackerReady: selectedSlot?.unit?.canAttackThisTurn === true,
      hasUnit: !!selectedSlot?.unit,
    });
    if (!slotState.shouldApply) return false;
    const mapped = buildSlotActionDescriptors(slotState.opponentHasUnit, slotState.attackerReady).map((d) => ({
      label: d.label,
      enabled: d.enabled,
      primary: d.primary,
      onClick: async () => {
        if (d.id === "attackUnit") {
          await this.deps.onAttackUnit();
          return;
        }
        if (d.id === "attackShieldArea") {
          await this.deps.onAttackShieldArea();
          return;
        }
        if (d.id === "cancelSelection") {
          this.deps.onCancelSelection();
        }
      },
    }));
    this.deps.actionControls?.setState?.({ descriptors: mapped });
    return true;
  }
}
