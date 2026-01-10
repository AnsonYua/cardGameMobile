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
    const isSelfTurn = this.isPlayersTurnFromRaw(raw);
    const isOpponentTurn = !isSelfTurn;
    const actionStepStatus = this.deps.actionStepCoordinator.getStatus(raw);
    const phase = (raw?.gameEnv?.phase || "").toString().toUpperCase();
    const isStartGamePhase = phase === "REDRAW_PHASE" || phase === "START_GAME" || phase === "STARTGAME";

    // Decision map (phase x turn):
    // Main Phase: opponent -> waiting, self -> existing defaults.
    // Blocker Flow: opponent/self -> existing blocker buttons (always wins).
    // Action Step (opponent):
    //   confirmations[currentPlayer] === false -> allow targets/actions.
    //   confirmations[currentPlayer] === true -> waiting.
    // Action Step (self): follow existing action-step logic.
    // Step 0: Start-game waiting message for both players.
    if (isStartGamePhase) {
      actions.setWaitingLabel?.("Preparing to start game...");
      actions.setWaitingForOpponent?.(true);
      actions.setState?.({ descriptors: [] });
      return;
    }

    // Step 1: Blocker flow (always wins, regardless of phase/turn).
    if (this.deps.blockerFlow.isActive() || phase === "BLOCKER_PHASE") {
      if (this.deps.blockerFlow.applyActionBar()) {
        return;
      }
    }

    // Step 2: Action step handling.
    if (actionStepStatus !== "none") {
      if (isOpponentTurn) {
        this.deps.actionStepCoordinator.applyActionBar(selection, actionStepStatus);
        return;
      }
      actions.setWaitingForOpponent?.(false);
      this.deps.actionStepCoordinator.applyActionBar(selection, actionStepStatus);
      return;
    }

    // Step 3: Main phase handling.
    if (isOpponentTurn) {
      actions.setWaitingLabel?.("Waiting for opponent...");
      actions.setWaitingForOpponent?.(true);
      actions.setState?.({ descriptors: [] });
      return;
    }
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
    const currentPlayer = raw?.gameEnv?.currentPlayer;
    const self = this.deps.gameContext.playerId;
    const inMainPhase = phase === "MAIN_PHASE" && currentPlayer === self;
    if (!inMainPhase) {
      this.lastPhase = phase;
      this.lastBattleActive = false;
      return;
    }
    const battleActive = this.hasActiveBattle();
    this.lastBattleActive = battleActive;
    if (!battleActive && this.lastPhase === "MAIN_PHASE") {
      if (!selection) {
        const defaults = this.deps.engine.getAvailableActions("neutral");
        actions.setState?.({
          descriptors: this.deps.buildActionDescriptors(defaults),
        });
        this.deps.handControls?.setHand?.(this.deps.handPresenter.toHandCards(raw, self));
        this.lastPhase = phase;
        return;
      }
      // If a selection exists, refresh the action bar directly without re-entering update loops.
      const selectedSource = selection.kind as ActionSource;
      const selectedActions = this.deps.engine.getAvailableActions(selectedSource);
      actions.setState?.({
        descriptors: this.deps.buildActionDescriptors(selectedActions),
      });
      this.lastPhase = phase;
      return;
    }
    if (this.lastPhase !== "MAIN_PHASE") {
      const defaults = this.deps.engine.getAvailableActions(source);
      actions.setState?.({
        descriptors: this.deps.buildActionDescriptors(defaults),
      });
      this.deps.handControls?.setHand?.(this.deps.handPresenter.toHandCards(raw, self));
    }
    this.lastPhase = phase;
  }

  private hasActiveBattle() {
    const raw: any = this.deps.engine.getSnapshot().raw;
    const battle = raw?.gameEnv?.currentBattle ?? raw?.gameEnv?.currentbattle;
    return !!battle;
  }

  private tryApplySlotActions(selection?: any) {
    if (selection?.kind !== "slot" || selection.owner !== "player") return false;
    const opponentHasUnit = this.deps.getOpponentRestedUnitSlots().length > 0;
    const selectedSlot = this.deps.getSelectedSlot();
    // Use unit.isRested for attack gating; fieldCardValue no longer carries isRested.
    const attackerRested = !!selectedSlot?.unit?.isRested;
    const attackerReady = !!selectedSlot?.unit?.cardUid && !attackerRested;
    const slotDescriptors: Array<{ id: string; label: string; enabled: boolean; primary?: boolean }> = [];
    if (opponentHasUnit) {
      slotDescriptors.push({
        id: "attackUnit",
        label: "Attack Unit",
        enabled: attackerReady,
        primary: true,
      });
    }
    slotDescriptors.push({
      id: "attackShieldArea",
      label: "Attack Shield",
      enabled: attackerReady,
      primary: !slotDescriptors.some((d) => d.primary),
    });
    slotDescriptors.push({
      id: "cancelSelection",
      label: "Cancel",
      enabled: true,
    });
    const mapped = slotDescriptors.map((d) => ({
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

  private isPlayersTurnFromRaw(raw: any) {
    const currentPlayer = raw?.gameEnv?.currentPlayer;
    return currentPlayer === this.deps.gameContext.playerId;
  }
}
