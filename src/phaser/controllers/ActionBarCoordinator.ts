import type { ActionDescriptor } from "../game/ActionRegistry";
import type { ActionSource, GameEngine } from "../game/GameEngine";
import type { GameContext } from "../game/GameContextStore";
import type { HandCardView } from "../ui/HandTypes";
import type { HandPresenter } from "../ui/HandPresenter";
import type { SlotViewModel } from "../ui/SlotTypes";
import type { ActionControls } from "./ControllerTypes";
import type { AttackTargetCoordinator } from "./AttackTargetCoordinator";
import type { BlockerFlowManager } from "./BlockerFlowManager";
import type { BurstChoiceFlowManager } from "./BurstChoiceFlowManager";
import type { BurstChoiceGroupFlowManager } from "./BurstChoiceGroupFlowManager";
import type { OptionChoiceFlowManager } from "./OptionChoiceFlowManager";
import type { PromptChoiceFlowManager } from "./PromptChoiceFlowManager";
import type { TokenChoiceFlowManager } from "./TokenChoiceFlowManager";
import type { ActionStepCoordinator } from "./ActionStepCoordinator";
import {
  computeActionBarDecision,
  computeMainPhaseState,
  findActiveTargetChoice,
  getPhase,
  isMainPhase,
  isPlayersTurn,
} from "./actionBarPolicy";
import { buildSlotAttackActionDescriptors } from "./actionBar/slotAttackProvider";
import { mergeActionDescriptors, normalizePrimary, sortActionDescriptors } from "./actionBar/descriptorUtils";
import { createLogger } from "../utils/logger";

type HandControls = {
  setHand: (cards: HandCardView[], opts?: { preserveSelectionUid?: string }) => void;
};

export class ActionBarCoordinator {
  private readonly log = createLogger("ActionBar");
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
      burstGroupFlow: BurstChoiceGroupFlowManager;
      burstFlow: BurstChoiceFlowManager;
      optionChoiceFlow: OptionChoiceFlowManager;
      promptChoiceFlow: PromptChoiceFlowManager;
      tokenChoiceFlow: TokenChoiceFlowManager;
      getSelection: () => any;
      getSelectedSlot: () => SlotViewModel | undefined;
      getOpponentUnitSlots: () => SlotViewModel[];
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
    this.log.debug("updateActionBarState", {
      source: opts.source,
      currentPlayer: raw?.gameEnv?.currentPlayer ?? raw?.currentPlayer,
      phase: getPhase(raw),
      burstGroupActive: this.deps.burstGroupFlow.isActive(),
      burstActive: this.deps.burstFlow.isActive(),
      optionChoiceActive: this.deps.optionChoiceFlow.isActive(),
      promptChoiceActive: this.deps.promptChoiceFlow.isActive(),
      tokenChoiceActive: this.deps.tokenChoiceFlow.isActive(),
    });
    if (this.deps.burstGroupFlow.applyActionBar()) return;
    if (this.deps.burstFlow.applyActionBar()) return;
    if (this.deps.promptChoiceFlow.applyActionBar()) return;
    if (this.deps.optionChoiceFlow.applyActionBar()) return;
    if (this.deps.tokenChoiceFlow.applyActionBar()) return;
    const selection = opts.selection ?? this.deps.getSelection();
    this.syncHand(raw, selection);
    const isSelfTurn = isPlayersTurn(raw, this.deps.gameContext.playerId);
    const isOpponentTurn = !isSelfTurn;
    const actionStepStatus = this.deps.actionStepCoordinator.getStatus(raw);
    const phase = getPhase(raw);

    const activeTargetChoice = findActiveTargetChoice(raw);
    if (activeTargetChoice) {
      const selfId = this.deps.gameContext.playerId;
      const ownerId = (activeTargetChoice.playerId ?? "").toString();
      const isOwner = !!selfId && !!ownerId && ownerId === selfId;
      if (!isOwner) {
        this.applyWaitingState(actions, "Waiting for opponent choice...");
        return;
      }
      actions.setWaitingForOpponent?.(false);
      actions.setState?.({ descriptors: [] });
      return;
    }

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
    const slotAttackDescriptors =
      selection?.kind === "slot"
        ? buildSlotAttackActionDescriptors({
            raw,
            selection,
            selectedSlot: this.deps.getSelectedSlot(),
            opponentUnitSlots: this.deps.getOpponentUnitSlots(),
            playerId: self,
          })
        : [];
    const selectedActions = selectedSource ? this.deps.engine.getAvailableActions(selectedSource) : [];
    const mergedSelectedActions =
      selection?.kind === "slot" ? mergeActionDescriptors(slotAttackDescriptors, selectedActions) : selectedActions;
    const mainPhaseState = computeMainPhaseState({
      phase,
      selection,
      source,
      battleActive,
      lastPhase: this.lastPhase,
      lastBattleActive: this.lastBattleActive,
      defaultActions: this.deps.engine.getAvailableActions(source),
      selectedActions: mergedSelectedActions,
    });
    this.lastPhase = mainPhaseState.lastPhase;
    this.lastBattleActive = mainPhaseState.lastBattleActive;
    if (!mainPhaseState.shouldUpdate || !mainPhaseState.descriptors) return;
    const ordered = normalizePrimary(sortActionDescriptors(mainPhaseState.descriptors));
    actions.setState?.({ descriptors: this.deps.buildActionDescriptors(ordered) });
    if (mainPhaseState.setHand) {
      this.deps.handControls?.setHand?.(this.deps.handPresenter.toHandCards(raw, self));
    }
  }

  private syncHand(raw: any, selection: any) {
    const self = this.deps.gameContext.playerId;
    if (!self) return;
    const preserveSelectionUid = selection?.kind === "hand" ? (selection.uid as string | undefined) : undefined;
    this.deps.handControls?.setHand?.(this.deps.handPresenter.toHandCards(raw, self), { preserveSelectionUid });
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
}
