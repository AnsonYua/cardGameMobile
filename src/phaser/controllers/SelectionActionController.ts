import type { ActionDescriptor } from "../game/ActionRegistry";
import type { GameContext } from "../game/GameContextStore";
import { GameEngine, type ActionSource } from "../game/GameEngine";
import type { HandCardView } from "../ui/HandTypes";
import { HandPresenter } from "../ui/HandPresenter";
import type { SlotViewModel, SlotOwner } from "../ui/SlotTypes";
import { SlotPresenter } from "../ui/SlotPresenter";
import { ApiManager } from "../api/ApiManager";
import type { EffectTargetController } from "./EffectTargetController";

type HandControls = {
  setHand: (cards: HandCardView[], opts?: { preserveSelectionUid?: string }) => void;
  clearSelection?: () => void;
};

type SlotControls = {
  setSelectedSlot?: (owner?: SlotOwner, slotId?: string) => void;
};

type ActionControls = {
  setState?: (state: { descriptors: any[] }) => void;
};

export class SelectionActionController {
  private selectedHandCard?: HandCardView;
  private lastPhase?: string;
  private selectedSlot?: SlotViewModel;

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
      gameContext: GameContext;
      refreshPhase: (skipFade: boolean) => void;
    },
  ) {}

  getSelectedHandCard() {
    return this.selectedHandCard;
  }

  handleHandCardSelected(card: HandCardView) {
    this.selectedHandCard = card;
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
    if (this.isOpponentSlotDuringPlayerTurn(slot)) {
      this.clearSelectionUI({ clearEngine: true });
      this.refreshActions("neutral");
      return;
    }
    this.selectedSlot = slot;
    this.selectedHandCard = undefined;
    this.deps.handControls?.clearSelection?.();
    this.deps.slotControls?.setSelectedSlot?.(slot.owner, slot.slotId);
    this.deps.engine.select({ kind: "slot", slotId: slot.slotId, owner: slot.owner });
    this.refreshActions("slot");
  }

  handleBaseCardSelected(payload?: { side: "opponent" | "player"; card?: any }) {
    this.selectedHandCard = undefined;
    this.selectedSlot = undefined;
    this.deps.slotControls?.setSelectedSlot?.();
    if (!payload?.card) return;
    this.deps.engine.select({ kind: "base", side: payload.side, cardId: payload.card?.cardId });
    this.refreshActions("base");
  }

  refreshActions(source: ActionSource = "neutral") {
    const selection = this.deps.engine.getSelection();
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
        id: "attackShield",
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
          if (d.id === "attackShield") {
            await this.handleAttackShield();
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
    if (actionId === "attackShield") {
      await this.handleAttackShield();
      return;
    }
    if (actionId === "cancelSelection") {
      this.handleCancelSelection();
      return;
    }
    const result = await this.deps.engine.runAction(actionId);
    if (result === false) return;
    this.refreshAfterStateChange(actionSource);
  }

  updateActionBarForPhase() {
    this.applyMainPhaseDefaults(false);
  }

  clearSelectionUI(opts: { clearEngine?: boolean } = {}) {
    this.selectedHandCard = undefined;
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

  private isOpponentSlotDuringPlayerTurn(slot: SlotViewModel) {
    return this.isPlayersTurn() && slot.owner === "opponent";
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

  private async handleAttackShield() {
    console.log("Attack Shield clicked (placeholder)");
  }

  private handleCancelSelection() {
    this.clearSelectionUI({ clearEngine: true });
    this.refreshActions("neutral");
  }

  private applyMainPhaseDefaults(force = false) {
    const raw = this.deps.engine.getSnapshot().raw as any;
    const actions = this.deps.actionControls;
    if (!raw || !actions) return;
    const phase = raw?.gameEnv?.phase;
    const currentPlayer = raw?.gameEnv?.currentPlayer;
    const self = this.deps.gameContext.playerId;
    const inMainPhase = phase === "MAIN_PHASE" && currentPlayer === self;
    if (!inMainPhase) {
      this.lastPhase = phase;
      return;
    }
    if (force || this.lastPhase !== "MAIN_PHASE") {
      actions.setState?.({
        descriptors: this.buildActionDescriptors([]),
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
    }
  }
}
