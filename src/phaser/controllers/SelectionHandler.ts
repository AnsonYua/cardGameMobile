import type { GameEngine } from "../game/GameEngine";
import type { GameContext } from "../game/GameContextStore";
import type { HandCardView } from "../ui/HandTypes";
import type { SlotViewModel } from "../ui/SlotTypes";
import type { SlotControls } from "./ControllerTypes";
import type { AttackTargetCoordinator } from "./AttackTargetCoordinator";
import type { BlockerFlowManager } from "./BlockerFlowManager";
import type { ActionStepCoordinator } from "./ActionStepCoordinator";

type HandControls = {
  setHand: (cards: HandCardView[], opts?: { preserveSelectionUid?: string }) => void;
  clearSelection?: () => void;
};

export class SelectionHandler {
  private selectedHandCard?: HandCardView;
  private selectedSlot?: SlotViewModel;

  constructor(
    private deps: {
      engine: GameEngine;
      handControls?: HandControls | null;
      slotControls?: SlotControls | null;
      gameContext: GameContext;
      blockerFlow: BlockerFlowManager;
      attackCoordinator: AttackTargetCoordinator;
      actionStepCoordinator: ActionStepCoordinator;
      refreshActions: (source: "neutral" | "hand" | "slot" | "base") => void;
      showOverlay?: (message: string, slot?: SlotViewModel) => void;
    },
  ) {}

  getSelectedHandCard() {
    return this.selectedHandCard;
  }

  getSelectedSlot() {
    return this.selectedSlot;
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

  handleHandCardSelected(card: HandCardView) {
    const raw = this.deps.engine.getSnapshot().raw as any;
    const actionStepStatus = this.deps.actionStepCoordinator.getStatus(raw);
    const isSelfTurn = this.isPlayersTurnFromRaw(raw);
    if (!isSelfTurn) {
      if (actionStepStatus === "awaiting") {
        if (!this.deps.actionStepCoordinator.isHandCardTarget(card.uid, raw)) {
          this.clearSelectionUI({ clearEngine: true });
          this.deps.refreshActions("neutral");
          return;
        }
      } else {
        this.clearSelectionUI({ clearEngine: true });
        this.deps.refreshActions("neutral");
        return;
      }
    }
    if (this.deps.actionStepCoordinator.isInActionStep(raw)) {
      if (!this.deps.actionStepCoordinator.isHandCardTarget(card.uid, raw)) {
        this.clearSelectionUI({ clearEngine: true });
        this.deps.refreshActions("neutral");
        return;
      }
      if (!this.deps.actionStepCoordinator.cardDataHasActionStepWindow(this.getHandCardData(card.uid))) {
        this.clearSelectionUI({ clearEngine: true });
        this.deps.refreshActions("neutral");
        return;
      }
    }
    this.selectedHandCard = card;
    this.selectedSlot = undefined;
    this.deps.slotControls?.setSelectedSlot?.();
    this.deps.engine.select({
      kind: "hand",
      uid: card.uid || "",
      cardType: card.cardType,
      fromPilotDesignation: card.fromPilotDesignation,
      cardId: card.cardId,
    });
    this.deps.refreshActions("hand");
  }

  async handleSlotCardSelected(slot: SlotViewModel) {
    const raw = this.deps.engine.getSnapshot().raw as any;
    this.deps.blockerFlow.handleSnapshot(raw);
    // let blocker flow inspect latest queue before acting on the slot click
    if (await this.deps.attackCoordinator.handleSlot(slot)) {
      return;
    }
    if (this.deps.attackCoordinator.isActive() && !this.deps.attackCoordinator.isAllowed(slot)) {
      this.deps.showOverlay?.("Unit cannot be attacked", slot);
      return;
    }
    if (this.deps.blockerFlow.isActive()) {
      // Block slot selection while blocker choice is in progress.
      this.clearSelectionUI({ clearEngine: true });
      this.deps.refreshActions("neutral");
      return;
    }
    if (this.deps.actionStepCoordinator.isInActionStep(raw)) {
      if (!this.deps.actionStepCoordinator.isSlotTarget(slot, raw)) {
        // Gate slot interactions to only allow cards that appear in the action-step targets list.
        this.clearSelectionUI({ clearEngine: true });
        this.deps.refreshActions("neutral");
        return;
      }
    }
    if (!this.isPlayersTurnFromRaw(raw) || slot.owner !== "player" || (!slot.unit && !slot.pilot)) {
      // disallow selecting opponent cards or empty slots when not in player turn
      this.clearSelectionUI({ clearEngine: true });
      this.deps.refreshActions("neutral");
      return;
    }
    if (this.deps.actionStepCoordinator.isInActionStep(raw) && !this.deps.actionStepCoordinator.slotHasActionStepWindow(slot)) {
      // block selecting slots outside current action-step window
      this.clearSelectionUI({ clearEngine: true });
      this.deps.refreshActions("neutral");
      return;
    }
    // mark this slot as the current action source and refresh UI
    this.selectedSlot = slot;
    this.selectedHandCard = undefined;
    this.deps.handControls?.clearSelection?.();
    this.deps.slotControls?.setSelectedSlot?.(slot.owner, slot.slotId);
    this.deps.engine.select({ kind: "slot", slotId: slot.slotId, owner: slot.owner });
    this.deps.refreshActions("slot");
  }

  handleBaseCardSelected(payload?: { side: "opponent" | "player"; card?: any }) {
    this.selectedHandCard = undefined;
    this.selectedSlot = undefined;
    this.deps.slotControls?.setSelectedSlot?.();
    if (!payload?.card) return;
    if (this.deps.actionStepCoordinator.isInActionStep() && !this.deps.actionStepCoordinator.cardDataHasActionStepWindow(payload.card?.cardData)) {
      this.clearSelectionUI({ clearEngine: true });
      this.deps.refreshActions("neutral");
      return;
    }
    this.deps.engine.select({ kind: "base", side: payload.side, cardId: payload.card?.cardId });
    this.deps.refreshActions("base");
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

  private isPlayersTurnFromRaw(raw: any) {
    const currentPlayer = raw?.gameEnv?.currentPlayer;
    return currentPlayer === this.deps.gameContext.playerId;
  }
}
