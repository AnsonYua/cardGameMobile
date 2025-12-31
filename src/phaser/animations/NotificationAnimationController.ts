import Phaser from "phaser";
import { PlayCardAnimationManager } from "./PlayCardAnimationManager";
import type { SlotViewModel, SlotCardView, SlotPositionMap, SlotOwner } from "../ui/SlotTypes";
import { toPreviewKey } from "../ui/HandTypes";

export type SlotNotification = {
  id: string;
  type: string;
  payload?: Record<string, any>;
  metadata?: Record<string, any>;
};

type ProcessArgs = {
  slots: SlotViewModel[];
  boardSlotPositions?: SlotPositionMap;
  cardLookup?: {
    findBaseCard?: (playerId?: string) => any;
    findCardByUid?: (cardUid?: string) => SlotCardView | undefined;
  };
  allowAnimations: boolean;
  currentPlayerId: string | null;
  shouldHideSlot?: (slotKey: string) => boolean;
};

export class NotificationAnimationController {
  private hiddenSlots = new Set<string>();

  constructor(
    private deps: {
      scene: Phaser.Scene;
      playAnimator: PlayCardAnimationManager;
      getBaseAnchor?: (isOpponent: boolean) =>
        | { x: number; y: number; isOpponent: boolean; w?: number; h?: number }
        | undefined;
      getSlotAreaCenter?: (owner: "player" | "opponent") => { x: number; y: number } | undefined;
      onSlotAnimationStart?: (slotKey: string) => void;
      onSlotAnimationEnd?: (slotKey: string) => void;
      setSlotVisible?: (owner: SlotOwner, slotId: string, visible: boolean) => void;
    },
  ) {}

  playCardPlayed(note: SlotNotification, args: ProcessArgs): Promise<void> {
    const { allowAnimations } = args;
    if (!allowAnimations) return Promise.resolve();
    if (!note || !note.id) return Promise.resolve();
    const type = (note.type || "").toUpperCase();
    if (type !== "CARD_PLAYED_COMPLETED") return Promise.resolve();
    const task = this.buildCardPlayedTask(note.payload ?? {}, args);
    if (!task) return Promise.resolve();
    return task();
  }

  private buildCardPlayedTask(payload: any, ctx: ProcessArgs): (() => Promise<void>) | null {
    if (!payload?.isCompleted) return null;
    const reason = (payload.reason ?? "").toString().toLowerCase();
    if (reason && reason !== "hand") return null;

    // Route based on play target (command/base/slot).
    const playAs = (payload.playAs ?? "").toString().toLowerCase();
    const playerId = payload.playerId ?? "";
    const isSelf = !!ctx.currentPlayerId && playerId === ctx.currentPlayerId;
    if (playAs === "command") {
      // eslint-disable-next-line no-console
      console.log("[CardPlayed] command animation", {
        cardUid: payload.carduid,
        playerId,
        isSelf,
      });
      const card = ctx.cardLookup?.findCardByUid?.(payload.carduid);
      return () => {
        // eslint-disable-next-line no-console
        console.log("[CardPlayed] command animate start", {
          cardUid: payload.carduid,
          hasCard: Boolean(card),
        });
        return this.animateCommand(payload, isSelf, card);
      };
    }
    if (playAs === "base") {
      const baseCard = ctx.cardLookup?.findBaseCard?.(payload.playerId);
      return () => this.animateBase(payload, isSelf, baseCard);
    }
    const slotTask = this.buildSlotAnimationTask(payload, isSelf, ctx);
    if (slotTask) {
      return slotTask;
    }
    return null;
  }

  private buildSlotAnimationTask(payload: any, isSelf: boolean, ctx: ProcessArgs): (() => Promise<void>) | null {
    const { slots, boardSlotPositions } = ctx;
    if (!boardSlotPositions) return null;
    const slot = this.findSlot(slots, payload.carduid);
    if (!slot) return null;
    let target = boardSlotPositions[slot.owner]?.[slot.slotId];
    if (!target && slot.owner === "opponent") {
      const fallback = this.deps.getSlotAreaCenter?.("opponent");
      if (fallback) {
        target = { id: "opponent-center", x: fallback.x, y: fallback.y, w: 0, h: 0, isOpponent: true };
      }
    }
    if (!target) return null;
    const slotKey = `${slot.owner}-${slot.slotId}`;
    const card = this.getSlotCard(slot, payload.carduid);
    const start = this.getHandOrigin(isSelf);
    const stats = {
      ap: slot.fieldCardValue?.totalAP ?? slot.ap ?? 0,
      hp: slot.fieldCardValue?.totalHP ?? slot.hp ?? 0,
    };
    const end = { x: target.x, y: target.y };
    const cardName = card?.cardData?.name ?? card?.id ?? payload.carduid;
    const fallbackLabel = card?.id ?? payload.carduid;
    const textureKey = card?.textureKey;
    const shouldHide = ctx.shouldHideSlot ? ctx.shouldHideSlot(slotKey) : true;
    return () =>
      this.animateSlotCard({
        slotKey,
        owner: slot.owner,
        slotId: slot.slotId,
        start,
        end,
        isOpponent: !isSelf,
        cardName,
        stats,
        textureKey,
        fallbackLabel,
        shouldHide,
      });
  }

  private async animateSlotCard(spec: {
    slotKey: string;
    owner: SlotOwner;
    slotId: string;
    start: { x: number; y: number; isOpponent?: boolean };
    end: { x: number; y: number };
    isOpponent: boolean;
    cardName: string;
    stats: { ap?: number; hp?: number };
    textureKey?: string;
    fallbackLabel?: string;
    shouldHide: boolean;
  }) {
    if (spec.shouldHide) {
      // Hide the slot while the flying card animates into it.
      this.hideSlot(spec.owner, spec.slotId);
    }
    this.deps.onSlotAnimationStart?.(spec.slotKey);
    try {
      await this.deps.playAnimator.play({
        textureKey: spec.textureKey,
        fallbackLabel: spec.fallbackLabel,
        start: spec.start,
        end: spec.end,
        isOpponent: spec.isOpponent,
        cardName: spec.cardName,
        stats: spec.stats,
      });
    } finally {
      this.deps.onSlotAnimationEnd?.(spec.slotKey);
      if (spec.shouldHide) {
        // Show slot again after the animation completes.
        this.showSlot(spec.owner, spec.slotId);
      }
    }
  }

  private async animateBase(payload: any, isSelf: boolean, baseCard?: any) {
    //if the base is opponent, the card should rotate 180
    const anchor = this.deps.getBaseAnchor?.(!isSelf);
    if (!anchor) return;
    const start = this.getHandOrigin(isSelf);
    const stats = {
      ap: baseCard?.fieldCardValue?.totalAP ?? 0,
      hp: baseCard?.fieldCardValue?.totalHP ?? 0,
    };
    const textureKey = baseCard ? toPreviewKey(baseCard.cardId ?? baseCard.id) : undefined;
    await this.deps.playAnimator.play({
      textureKey,
      fallbackLabel: baseCard?.cardId ?? payload.carduid,
      start,
      end: { x: anchor.x, y: anchor.y },
      isOpponent: !isSelf,
      cardName: baseCard?.cardData?.name ?? baseCard?.cardId ?? "Base",
      stats,
      size: anchor.w && anchor.h ? { w: anchor.w, h: anchor.h } : undefined,
      angle: anchor.isOpponent ? 180 : 0,
    });
  }

  private animateCommand(payload: any, isSelf: boolean, card?: SlotCardView) {
    //if it is opponent , the end poistion should go to opponent slot center
    const cam = this.deps.scene.cameras.main;
    const start = this.getHandOrigin(isSelf);
    const opponentCenter = this.deps.getSlotAreaCenter?.("opponent");
    const end =
      !isSelf && opponentCenter
        ? { x: opponentCenter.x, y: opponentCenter.y }
        : { x: cam.centerX, y: cam.centerY };
    const stats = {
      ap: card?.cardData?.ap ?? 0,
      hp: card?.cardData?.hp ?? 0,
    };
    return this.deps.playAnimator.play({
      textureKey: card?.textureKey,
      fallbackLabel: card?.id ?? payload.carduid,
      start,
      end,
      isOpponent: !isSelf,
      cardName: card?.cardData?.name ?? card?.id ?? "Command",
      stats,
    });
  }

  private getHandOrigin(isSelf: boolean) {
    const cam = this.deps.scene.cameras.main;
    const y = isSelf ? cam.height - 60 : cam.height * 0.12;
    return { x: cam.centerX, y, isOpponent: !isSelf };
  }

  private findSlot(slots: SlotViewModel[], cardUid?: string) {
    if (!cardUid) return undefined;
    return slots.find(
      (slot) => slot.unit?.cardUid === cardUid || slot.pilot?.cardUid === cardUid,
    );
  }

  private getSlotCard(slot: SlotViewModel, cardUid?: string): SlotCardView | undefined {
    if (!cardUid) return slot.unit || slot.pilot;
    if (slot.unit?.cardUid === cardUid) return slot.unit;
    if (slot.pilot?.cardUid === cardUid) return slot.pilot;
    return slot.unit || slot.pilot;
  }


  private hideSlot(owner?: SlotOwner, slotId?: string) {
    if (!owner || !slotId) return;
    const key = `${owner}-${slotId}`;
    if (this.hiddenSlots.has(key)) return;
    // eslint-disable-next-line no-console
    console.log("[NotificationAnimator] hideSlot", key);
    this.deps.setSlotVisible?.(owner, slotId, false);
    this.hiddenSlots.add(key);
  }

  private showSlot(owner?: SlotOwner, slotId?: string) {
    if (!owner || !slotId) return;
    const key = `${owner}-${slotId}`;
    if (!this.hiddenSlots.has(key)) return;
    // eslint-disable-next-line no-console
    console.log("[NotificationAnimator] showSlot", key);
    this.hiddenSlots.delete(key);
    this.deps.setSlotVisible?.(owner, slotId, true);
  }

  
}
