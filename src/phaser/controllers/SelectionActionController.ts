import type { ActionDescriptor } from "../game/ActionRegistry";
import type { GameContext } from "../game/GameContextStore";
import { GameEngine, type ActionSource } from "../game/GameEngine";
import { ENGINE_EVENTS } from "../game/EngineEvents";
import type { HandCardView } from "../ui/HandTypes";
import { HandPresenter } from "../ui/HandPresenter";
import type { SlotViewModel, SlotOwner, SlotPositionMap } from "../ui/SlotTypes";
import { SlotPresenter } from "../ui/SlotPresenter";
import { ApiManager } from "../api/ApiManager";
import type { EffectTargetController } from "./EffectTargetController";
import { AttackIndicator } from "../animations/AttackIndicator";

type HandControls = {
  setHand: (cards: HandCardView[], opts?: { preserveSelectionUid?: string }) => void;
  clearSelection?: () => void;
};

type SlotControls = {
  setSelectedSlot?: (owner?: SlotOwner, slotId?: string) => void;
  getSlotPositions?: () => SlotPositionMap | undefined;
};

type ActionControls = {
  setState?: (state: { descriptors: any[] }) => void;
};

export class SelectionActionController {
  private selectedHandCard?: HandCardView;
  private selectedBaseCard?: any;
  private lastPhase?: string;
  private selectedSlot?: SlotViewModel;
  private lastBattleActive = false;
  private lastBattleStatus?: string;
  private activeAttackIndicator?: { attackerSlot: string; targetSlot: string };

  constructor(
    private deps: {
      engine: GameEngine;
      slotPresenter: SlotPresenter;
      handPresenter: HandPresenter;
      api: ApiManager;
      handControls?: HandControls | null;
      slotControls?: SlotControls | null;
      actionControls?: ActionControls | null;
      effectTargetController?: EffectTargetController | null;
      attackIndicator?: AttackIndicator | null;
      gameContext: GameContext;
      refreshPhase: (skipFade: boolean) => void;
    },
  ) {
    // React to battle state changes emitted by the engine instead of re-parsing snapshots everywhere.
    this.deps.engine.events.on(ENGINE_EVENTS.BATTLE_STATE_CHANGED, (payload: { active: boolean; status: string }) => {
      this.handleBattleStateChanged(payload);
    });
  }

  getSelectedHandCard() {
    return this.selectedHandCard;
  }

  handleHandCardSelected(card: HandCardView) {
    if (this.isActionStepPhase() && !this.cardDataHasActionStepWindow(this.getHandCardData(card.uid))) {
      this.clearSelectionUI({ clearEngine: true });
      this.refreshActions("neutral");
      return;
    }
    this.selectedHandCard = card;
    this.selectedSlot = undefined;
    this.selectedBaseCard = undefined;
    this.deps.slotControls?.setSelectedSlot?.();
    this.deps.engine.select({
      kind: "hand",
      uid: card.uid || "",
      cardType: card.cardType,
      fromPilotDesignation: card.fromPilotDesignation,
      cardId: card.cardId,
    });
    this.refreshActions("hand");
  }

  handleSlotCardSelected(slot: SlotViewModel) {
    if (!this.isPlayersTurn() || slot.owner !== "player" || !slot.unit) {
      this.clearSelectionUI({ clearEngine: true });
      this.refreshActions("neutral");
      return;
    }
    if (this.isActionStepPhase() && !this.slotHasActionStepWindow(slot)) {
      this.clearSelectionUI({ clearEngine: true });
      this.refreshActions("neutral");
      return;
    }
    this.selectedSlot = slot;
    this.selectedHandCard = undefined;
    this.selectedBaseCard = undefined;
    this.deps.handControls?.clearSelection?.();
    this.deps.slotControls?.setSelectedSlot?.(slot.owner, slot.slotId);
    this.deps.engine.select({ kind: "slot", slotId: slot.slotId, owner: slot.owner });
    this.refreshActions("slot");
  }

  handleBaseCardSelected(payload?: { side: "opponent" | "player"; card?: any }) {
    this.selectedHandCard = undefined;
    this.selectedSlot = undefined;
    this.selectedBaseCard = payload?.card;
    this.deps.slotControls?.setSelectedSlot?.();
    if (!payload?.card) return;
    if (this.isActionStepPhase() && !this.cardDataHasActionStepWindow(payload.card?.cardData)) {
      this.clearSelectionUI({ clearEngine: true });
      this.refreshActions("neutral");
      return;
    }
    this.deps.engine.select({ kind: "base", side: payload.side, cardId: payload.card?.cardId });
    this.refreshActions("base");
  }

  refreshActions(source: ActionSource = "neutral") {
    console.log("[refreshActions] source", source, "selection", this.deps.engine.getSelection());
    const selection = this.deps.engine.getSelection();
    if (this.applyBattleActionBar(selection)) {
      return;
    }
    if (source === "slot" && selection?.kind === "slot" && selection.owner === "player") {
      const opponentHasUnit = this.checkOpponentHasUnit();
      const slotDescriptors: ActionDescriptor[] = [];
      if (opponentHasUnit) {
        slotDescriptors.push({
          id: "attackUnit",
          label: "Attack Unit",
          enabled: true,
          primary: true,
        });
      }
      slotDescriptors.push({
        id: "attackShieldArea",
        label: "Attack Shield",
        enabled: true,
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
            await this.handleAttackUnit();
            return;
          }
          if (d.id === "attackShieldArea") {
            await this.handleAttackShieldArea();
            return;
          }
          if (d.id === "cancelSelection") {
            this.handleCancelSelection();
          }
        },
      }));
      this.deps.actionControls?.setState?.({ descriptors: mapped });
      return;
    }
    const descriptors = this.deps.engine.getAvailableActions(source);
    const mapped = this.buildActionDescriptors(descriptors);
    this.deps.actionControls?.setState?.({ descriptors: mapped });
  }

  refreshAfterStateChange(actionSource: ActionSource = "neutral") {
    this.deps.refreshPhase(true);
    this.refreshActions(actionSource);
  }

  async runActionThenRefresh(actionId: string, actionSource: ActionSource = "neutral") {
    // Slot-specific actions are handled directly to avoid engine placeholders.
    if (actionId === "attackUnit") {
      await this.handleAttackUnit();
      return;
    }
    if (actionId === "attackShieldArea") {
      await this.handleAttackShieldArea();
      return;
    }
    if (actionId === "skipAction") {
      await this.handleSkipAction();
      return;
    }
    if (actionId === "cancelSelection") {
      this.handleCancelSelection();
      return;
    }
    console.log("print commend action")
    const result = await this.deps.engine.runAction(actionId);
    if (result === false) return;
    this.refreshAfterStateChange(actionSource);
  }

  updateActionBarForPhase() {
    console.log("[updateActionBarForPhase] entry");
    this.applyMainPhaseDefaults();
  }

  clearSelectionUI(opts: { clearEngine?: boolean } = {}) {
    this.selectedHandCard = undefined;
    this.selectedBaseCard = undefined;
    this.selectedSlot = undefined;
    this.deps.slotControls?.setSelectedSlot?.();
    this.deps.handControls?.clearSelection?.();
    if (opts.clearEngine) {
      this.deps.engine.clearSelection();
    }
  }

  private buildActionDescriptors(descriptors: ActionDescriptor[]) {
    return descriptors.map((d) => ({
      label: d.label,
      enabled: d.enabled,
      primary: d.primary,
      onClick: async () => {
        await this.runActionThenRefresh(d.id, "neutral");
      },
    }));
  }

  private isPlayersTurn() {
    const raw: any = this.deps.engine.getSnapshot().raw;
    const currentPlayer = raw?.gameEnv?.currentPlayer;
    return currentPlayer === this.deps.gameContext.playerId;
  }

  private async handleAttackUnit() {
    const targets = this.getOpponentUnitSlots();
    if (!targets.length) {
      console.warn("No opponent units to target");
      return;
    }
    await this.deps.effectTargetController?.showManualTargets({
      targets,
      header: "Choose a target to attack",
      onSelect: async (slot) => {
        await this.performAttackUnit(slot);
      },
    });
  }

  private async handleAttackShieldArea() {
    if (!this.selectedSlot?.unit?.cardUid) {
      console.warn("No attacker selected for shield attack");
      return;
    }
    const attackerCarduid = this.selectedSlot.unit.cardUid;
    const targetPlayerId = this.getOpponentPlayerId();
    const gameId = this.deps.gameContext.gameId;
    const playerId = this.deps.gameContext.playerId;
    if (!gameId || !playerId || !targetPlayerId) {
      console.warn("Missing data for attackShieldArea", { gameId, playerId, targetPlayerId });
      return;
    }
    const payload = {
      playerId,
      gameId,
      actionType: "attackShieldArea",
      attackerCarduid,
      targetType: "shield",
      targetPlayerId,
      targetPilotUid: null as string | null,
    };
    try {
      await this.deps.api.playerAction(payload);
      await this.deps.engine.updateGameStatus(gameId, playerId);
      this.handleCancelSelection();
    } catch (err) {
      console.warn("attackShieldArea request failed", err);
    }
  }

  private handleCancelSelection() {
    this.clearSelectionUI({ clearEngine: true });
    this.refreshActions("neutral");
  }

  private async handleSkipAction() {
    const gameId = this.deps.gameContext.gameId;
    const playerId = this.deps.gameContext.playerId;
    if (!gameId || !playerId) return;
    const payload = {
      playerId,
      gameId,
      actionType: "confirmBattle",
    };
    try {
      await this.deps.api.playerAction(payload);
      await this.deps.engine.updateGameStatus(gameId, playerId);
      this.clearSelectionUI({ clearEngine: true });
      this.refreshActions("neutral");
    } catch (err) {
      console.warn("confirmBattle request failed", err);
    }
  }

  private applyBattleActionBar(selection: any) {
    const battleState = this.getBattleState();
    console.log("[applyBattleActionBar] battleState", battleState, "selection", selection);
    if (battleState === "none") return false;
    const hasActionStepEffect = selection ? this.selectionHasActionStepWindow(selection) : false;
    console.log("[applyBattleActionBar] hasActionStepEffect", hasActionStepEffect);
    if (battleState === "confirmed") {
      this.deps.actionControls?.setState?.({ descriptors: [] });
      return true;
    }
    if (hasActionStepEffect) {
      this.deps.actionControls?.setState?.({
        descriptors: [
          {
            label: "Activate Effect",
            enabled: true,
            primary: true,
            onClick: async () => {
              await this.handleActionStepActivate();
            },
          },
          {
            label: "Cancel",
            enabled: true,
            onClick: () => this.handleCancelSelection(),
          },
        ],
      });
      return true;
    }
    this.deps.actionControls?.setState?.({
      descriptors: [
        {
          label: "Skip Action",
          enabled: true,
          primary: true,
          onClick: async () => {
            await this.handleSkipAction();
          },
        },
      ],
    });
    return true;
  }

  private getBattleState(): "awaiting" | "confirmed" | "none" {
    const raw: any = this.deps.engine.getSnapshot().raw;
    const battle = raw?.gameEnv?.currentBattle ?? raw?.gameEnv?.currentbattle;
    const currentPlayer = raw?.gameEnv?.currentPlayer;
    const self = this.deps.gameContext.playerId;
    console.log("[getBattleState] battle", battle, "currentPlayer", currentPlayer, "self", self);
    if (!battle || !currentPlayer || currentPlayer !== self) return "none";
    const status = (battle.status || "").toString().toUpperCase();
    const confirmations = battle.confirmations || {};
    const confirmed = confirmations[currentPlayer];
    if (status === "ACTION_STEP") {
      if (confirmed === false) return "awaiting";
      if (confirmed === true) return "confirmed";
    }
    return "none";
  }

  private isActionStepPhase() {
    // Prefer the latest battle event if available; otherwise fall back to snapshot parsing.
    if (this.lastBattleActive && (this.lastBattleStatus || "").toUpperCase() === "ACTION_STEP") {
      return true;
    }
    return this.getBattleState() !== "none";
  }

  private handleBattleStateChanged(payload: { active: boolean; status: string }) {
    const status = (payload.status || "").toUpperCase();
    // No-op if nothing changed; avoids resetting actions on every poll.
    if (payload.active === this.lastBattleActive && status === (this.lastBattleStatus || "").toUpperCase()) {
      return;
    }
    const wasActive = this.lastBattleActive;
    this.lastBattleActive = payload.active;
    this.lastBattleStatus = payload.status;
    if (payload.active && status === "ACTION_STEP") {
      // When entering action step, recompute the action bar based on current selection.
      this.applyBattleActionBar(this.deps.engine.getSelection());
    } else if (wasActive && !payload.active) {
      // On exit, restore neutral actions.
      this.refreshActions("neutral");
    }
  }

  private async handleActionStepActivate() {
    const selection = this.deps.engine.getSelection();
    if (!selection) {
      console.warn("No selection to activate");
      return;
    }
    if (selection.kind === "hand") {
      const cardType = (this.selectedHandCard?.cardType || "").toLowerCase();
      console.log("[handleActionStepActivate] hand cardType", cardType);
      if (cardType === "command") {
        await this.runActionThenRefresh("playCommandFromHand", "hand");
        return;
      }
      console.warn("Hand card activation unsupported for type", cardType);
      return;
    }
    if (selection.kind === "slot") {
      console.log("Activate effect from slot (placeholder)");
      this.handleCancelSelection();
      return;
    }
    if (selection.kind === "base") {
      console.log("Activate effect from base (placeholder)");
      this.handleCancelSelection();
    }
  }

  private selectionHasActionStepWindow(selection: any) {
    if (!selection) return false;
    if (selection.kind === "hand") {
      return this.cardDataHasActionStepWindow(this.getHandCardData(selection.uid));
    }
    if (selection.kind === "slot") {
      const slot = this.getSlotBySelection(selection);
      return this.slotHasActionStepWindow(slot);
    }
    if (selection.kind === "base") {
      const baseCard = this.selectedBaseCard || this.getBaseCardData(selection.side === "opponent");
      return this.cardDataHasActionStepWindow(baseCard?.cardData);
    }
    return false;
  }

  private cardDataHasActionStepWindow(cardData: any) {
    const rules: any[] = Array.isArray(cardData?.effects?.rules) ? cardData.effects.rules : [];
    return rules.some((r) => {
      const wins: any[] = Array.isArray(r?.timing?.windows) ? r.timing.windows : [];
      return wins.some((w) => (w || "").toString().toUpperCase() === "ACTION_STEP");
    });
  }

  private slotHasActionStepWindow(slot?: SlotViewModel) {
    if (!slot) return false;
    const unitHas = this.cardDataHasActionStepWindow(slot.unit?.cardData);
    const pilotHas = this.cardDataHasActionStepWindow(slot.pilot?.cardData);
    return unitHas || pilotHas;
  }

  private getHandCardData(uid?: string | null) {
    if (!uid) return null;
    const raw: any = this.deps.engine.getSnapshot().raw;
    const selfId = this.deps.gameContext.playerId;
    const hand: any[] = raw?.gameEnv?.players?.[selfId]?.deck?.hand || [];
    const found = hand.find((c) => {
      const cid = c?.carduid ?? c?.uid ?? c?.id ?? c?.cardId;
      return cid === uid;
    });
    return found?.cardData;
  }

  private getSlotBySelection(selection: { slotId?: string; owner?: SlotOwner }) {
    if (!selection?.slotId || !selection.owner) return undefined;
    const raw: any = this.deps.engine.getSnapshot().raw;
    const selfId = this.deps.gameContext.playerId;
    const slots = this.deps.slotPresenter.toSlots(raw, selfId);
    return slots.find((s) => s.slotId === selection.slotId && s.owner === selection.owner);
  }

  private getBaseCardData(isOpponent: boolean) {
    const raw: any = this.deps.engine.getSnapshot().raw;
    const players = raw?.gameEnv?.players || {};
    const ids = Object.keys(players);
    const selfId = this.deps.gameContext.playerId && players[this.deps.gameContext.playerId] ? this.deps.gameContext.playerId : ids[0];
    const opponentId = ids.find((id) => id !== selfId);
    const targetId = isOpponent ? opponentId : selfId;
    const baseArr: any[] = players[targetId || ""]?.zones?.base || players[targetId || ""]?.base || [];
    return baseArr && baseArr[0];
  }

  private hasActiveBattle() {
    const raw: any = this.deps.engine.getSnapshot().raw;
    const battle = raw?.gameEnv?.currentBattle ?? raw?.gameEnv?.currentbattle;
    return !!battle;
  }

  private applyMainPhaseDefaults() {
    const raw = this.deps.engine.getSnapshot().raw as any;
    const actions = this.deps.actionControls;
    if (!raw || !actions) return;
    const phase = raw?.gameEnv?.phase;
    const currentPlayer = raw?.gameEnv?.currentPlayer;
    const self = this.deps.gameContext.playerId;
    const inMainPhase = phase === "MAIN_PHASE" && currentPlayer === self;
    console.log("[applyMainPhaseDefaults] phase", phase, "currentPlayer", currentPlayer, "self", self, "inMainPhase", inMainPhase);
    if (!inMainPhase) {
      this.lastPhase = phase;
      this.lastBattleActive = false;
      return;
    }
    const battleActive = this.hasActiveBattle();
    this.lastBattleActive = battleActive;
    // Always reevaluate battle UI while in MAIN_PHASE so ACTION_STEP updates the bar even without a phase change.
    if (this.applyBattleActionBar(this.deps.engine.getSelection())) {
      this.lastPhase = phase;
      return;
    }
    if (!battleActive && this.lastPhase === "MAIN_PHASE") {
      const selection = this.deps.engine.getSelection();
      if (!selection) {
        const defaults = this.deps.engine.getAvailableActions("neutral");
        actions.setState?.({
          descriptors: this.buildActionDescriptors(defaults),
        });
        this.deps.handControls?.setHand?.(this.deps.handPresenter.toHandCards(raw, self));
        this.lastPhase = phase;
        return;
      }
      // If a selection exists, keep its action bar alive instead of resetting to End Turn.
      this.refreshActions(selection.kind as ActionSource);
      this.lastPhase = phase;
      return;
    }
    if (this.lastPhase !== "MAIN_PHASE") {
      const defaults = this.deps.engine.getAvailableActions("neutral");
      actions.setState?.({
        descriptors: this.buildActionDescriptors(defaults),
      });
      this.deps.handControls?.setHand?.(this.deps.handPresenter.toHandCards(raw, self));
    }
    this.lastPhase = phase;
  }

  private checkOpponentHasUnit() {
    const snapshot = this.deps.engine.getSnapshot();
    const raw: any = snapshot.raw;
    if (!raw) return false;
    const playerId = this.deps.gameContext.playerId;
    const slots = this.deps.slotPresenter.toSlots(raw, playerId);
    return slots.some((s) => s.owner === "opponent" && !!s.unit);
  }

  private getOpponentUnitSlots(): SlotViewModel[] {
    const snapshot = this.deps.engine.getSnapshot();
    const raw: any = snapshot.raw;
    if (!raw) return [];
    const playerId = this.deps.gameContext.playerId;
    const slots = this.deps.slotPresenter.toSlots(raw, playerId);
    return slots.filter((s) => s.owner === "opponent" && !!s.unit);
  }

  private getOpponentPlayerId() {
    const raw: any = this.deps.engine.getSnapshot().raw;
    const players = raw?.gameEnv?.players || {};
    const allIds = Object.keys(players);
    const selfId = this.deps.gameContext.playerId;
    return allIds.find((id) => id !== selfId);
  }

  private tryShowAttackIndicator(target: SlotViewModel) {
    if (!this.deps.attackIndicator || !this.selectedSlot) {
      console.warn("[SelectionActionController] Missing attack indicator or attacker slot");
      return;
    }
    const positions = this.deps.slotControls?.getSlotPositions?.();
    if (!positions) {
      console.warn("[SelectionActionController] Slot positions unavailable for attack indicator");
      return;
    }
    const attackerCenter = this.getSlotCenter(positions, this.selectedSlot);
    const targetCenter = this.getSlotCenter(positions, target);
    if (!attackerCenter || !targetCenter) {
      console.warn("[SelectionActionController] Unable to compute slot centers", {
        attacker: this.selectedSlot?.slotId,
        target: target.slotId,
        attackerCenter,
        targetCenter,
      });
      return;
    }
    console.log("[SelectionActionController] Showing attack indicator", {
      from: attackerCenter,
      to: targetCenter,
      attackerSlot: this.selectedSlot.slotId,
      targetSlot: target.slotId,
    });
    this.deps.attackIndicator.show({ from: attackerCenter, to: targetCenter });
  }

  private getSlotCenter(map: SlotPositionMap | undefined, slot?: SlotViewModel) {
    if (!map || !slot) return undefined;
    const entry = map[slot.owner]?.[slot.slotId];
    if (!entry) return undefined;
    return { x: entry.x, y: entry.y };
  }

  private async performAttackUnit(target: SlotViewModel) {
    if (!this.selectedSlot?.unit?.cardUid) {
      console.warn("No attacker selected");
      return;
    }
    const attackerCarduid = this.selectedSlot.unit.cardUid;
    const targetUnitUid = target.unit?.cardUid;
    const targetPlayerId = this.getOpponentPlayerId();
    const gameId = this.deps.gameContext.gameId;
    const playerId = this.deps.gameContext.playerId;
    if (!gameId || !playerId || !targetUnitUid || !targetPlayerId) {
      console.warn("Missing data for attackUnit", { gameId, playerId, targetUnitUid, targetPlayerId });
      return;
    }
    this.tryShowAttackIndicator(target);
    const payload = {
      playerId,
      gameId,
      actionType: "attackUnit",
      attackerCarduid,
      targetType: "unit",
      targetUnitUid,
      targetPlayerId,
      targetPilotUid: null,
    };
    try {
      await this.deps.api.playerAction(payload);
      await this.deps.engine.updateGameStatus(gameId, playerId);
      this.handleCancelSelection();
    } catch (err) {
      console.warn("attackUnit request failed", err);
      this.handleCancelSelection();
    }
  }

  private hideAttackIndicator(opts: { immediate?: boolean; fadeDuration?: number } = {}) {
    if (!this.deps.attackIndicator || !this.activeAttackIndicator) return;
    this.deps.attackIndicator.hide(opts);
    this.activeAttackIndicator = undefined;
  }
}
