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
import type { ActionStepCoordinator } from "./ActionStepCoordinator";
import { buildSlotActionDescriptors, getPhase, isMainPhase, isPlayersTurn } from "./actionBarRules";
import { computeActionBarDecision, computeMainPhaseState, computeSlotActionState } from "./actionBarState";
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
      burstFlow: BurstChoiceFlowManager;
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
    this.log.debug("updateActionBarState", {
      source: opts.source,
      currentPlayer: raw?.gameEnv?.currentPlayer ?? raw?.currentPlayer,
      phase: getPhase(raw),
      burstActive: this.deps.burstFlow.isActive(),
    });
    if (this.deps.burstFlow.applyActionBar()) return;
    const selection = opts.selection ?? this.deps.getSelection();
    const isSelfTurn = isPlayersTurn(raw, this.deps.gameContext.playerId);
    const isOpponentTurn = !isSelfTurn;
    const actionStepStatus = this.deps.actionStepCoordinator.getStatus(raw);
    const phase = getPhase(raw);
    // Use console to ensure visibility regardless of logger level.
    console.log("[ActionBar] updateActionBarState status", {
      isSelfTurn,
      isOpponentTurn,
      actionStepStatus,
      phase,
      playerId: this.deps.gameContext.playerId,
    });

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
    console.log("[ActionBar] actionBar decision", { decision });

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
    console.log("[ActionBar] applyMainPhaseDefaults", {
      phase,
      playerId: self,
      currentPlayer: raw?.gameEnv?.currentPlayer,
      inMainPhase,
      selection: selection?.kind,
    });
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
    console.log("[ActionBar] applyMainPhaseDefaults descriptors", {
      source,
      count: mainPhaseState.descriptors.length,
      setHand: mainPhaseState.setHand,
    });
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
    const raw: any = this.deps.engine.getSnapshot().raw;
    const phaseAllowsAttack = this.phaseAllowsAttack(raw);
    const slotState = computeSlotActionState({
      selection,
      opponentHasUnit: this.deps.getOpponentRestedUnitSlots().length > 0,
      attackerReady: selectedSlot?.unit?.canAttackThisTurn === true && selectedSlot?.unit?.isRested !== true,
      hasUnit: !!selectedSlot?.unit,
      phaseAllowsAttack,
    });
    if (!slotState.shouldApply) return false;
    const allowAttackShield = !this.hasAttackShieldRestriction(raw, selectedSlot?.slotId);
    const mapped = buildSlotActionDescriptors(
      slotState.opponentHasUnit,
      slotState.attackerReady,
      allowAttackShield,
    ).map((d) => ({
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

  private phaseAllowsAttack(raw?: any) {
    if (!raw) return false;
    const env = raw?.gameEnv ?? raw;
    const explicit =
      env?.phaseAllowsAttack ??
      env?.allowAttack ??
      env?.canAttack ??
      env?.phaseWindow?.allowAttack ??
      env?.phaseWindow?.canAttack;
    if (explicit !== undefined && explicit !== null) {
      return !!explicit;
    }
    const phase = (env?.phase ?? "").toString().toUpperCase();
    return phase === "MAIN_PHASE";
  }

  private hasAttackShieldRestriction(raw: any, slotId?: string) {
    if (!raw || !slotId) return false;
    const playerId = this.deps.gameContext.playerId;
    const slot = raw?.gameEnv?.players?.[playerId]?.zones?.[slotId];
    const unit = slot?.unit;
    const effects = this.collectActiveEffects(unit);
    return effects.some((effect) => {
      const action = (effect?.action ?? "").toString().toLowerCase();
      const restriction = (effect?.parameters?.restriction ?? "").toString().toLowerCase();
      return action === "restrict_attack" && restriction === "cannot_attack_player";
    });
  }

  private collectActiveEffects(unit?: any) {
    const effects = [
      ...(Array.isArray(unit?.activeEffects) ? unit.activeEffects : []),
      ...(Array.isArray(unit?.effects?.active) ? unit.effects.active : []),
      ...(Array.isArray(unit?.effects?.activeEffects) ? unit.effects.activeEffects : []),
      ...(Array.isArray(unit?.cardData?.effects?.active) ? unit.cardData.effects.active : []),
    ];
    return effects.filter(Boolean);
  }
}
