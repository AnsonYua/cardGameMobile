import Phaser from "phaser";
import { PlayCardAnimationManager } from "./PlayCardAnimationManager";
import type { SlotViewModel, SlotCardView, SlotPositionMap } from "../ui/SlotTypes";
import { toPreviewKey } from "../ui/HandTypes";

export type SlotNotification = {
  id: string;
  type: string;
  payload?: Record<string, any>;
  metadata?: Record<string, any>;
};

type ProcessArgs = {
  notifications: SlotNotification[];
  slots: SlotViewModel[];
  slotPositions?: SlotPositionMap;
  raw: any;
  allowAnimations: boolean;
  currentPlayerId: string | null;
};

export class NotificationAnimationController {
  private processedIds = new Set<string>();

  constructor(
    private deps: {
      scene: Phaser.Scene;
      playAnimator: PlayCardAnimationManager;
      getBaseAnchor?: (isOpponent: boolean) =>
        | { x: number; y: number; isOpponent: boolean; w?: number; h?: number }
        | undefined;
    },
  ) {}

  resetProcessed() {
    this.processedIds.clear();
  }

  process(args: ProcessArgs) {
    const { notifications, allowAnimations } = args;

    if (!notifications?.length) return;

    if (!allowAnimations) {
      return;
    }

    notifications.forEach((note) => {
      if (!note || !note.id || this.processedIds.has(note.id)) return;
      const type = (note.type || "").toUpperCase();
      if (type === "CARD_PLAYED") {
        const handled = this.handleCardPlayed(note.payload ?? {}, args);
        if (handled) {
          this.processedIds.add(note.id);
        }
      }
    });
  }

  private handleCardPlayed(payload: any, ctx: ProcessArgs) {
    if (!payload?.isCompleted) return false;
    const reason = (payload.reason ?? "").toString().toLowerCase();
    if (reason && reason !== "hand") return false;

    const playAs = (payload.playAs ?? "").toString().toLowerCase();
    const playerId = payload.playerId ?? "";
    const isSelf = !!ctx.currentPlayerId && playerId === ctx.currentPlayerId;
    if (playAs === "command") {
      this.animateCommand(payload, isSelf, ctx.raw);
      return true;
    }
    if (playAs === "base") {
      this.animateBase(payload, isSelf, ctx.raw);
      return true;
    }
    const animated = this.animateSlotCard(payload, isSelf, ctx);
    return animated;
  }

  private animateSlotCard(payload: any, isSelf: boolean, ctx: ProcessArgs) {
    const { slots, slotPositions } = ctx;
    if (!slotPositions) return false;
    const slot = this.findSlot(slots, payload.carduid);
    if (!slot) return false;
    const target = slotPositions[slot.owner]?.[slot.slotId];
    if (!target) return false;
    const card = this.getSlotCard(slot, payload.carduid);
    const start = this.getHandOrigin(isSelf);
    const stats = {
      ap: slot.fieldCardValue?.totalAP ?? slot.ap ?? 0,
      hp: slot.fieldCardValue?.totalHP ?? slot.hp ?? 0,
    };
    void this.deps.playAnimator.play({
      textureKey: card?.textureKey,
      fallbackLabel: card?.id ?? payload.carduid,
      start,
      end: { x: target.x, y: target.y },
      isOpponent: !isSelf,
      cardName: card?.cardData?.name ?? card?.id ?? payload.carduid,
      stats,
    });
    return true;
  }

  private animateBase(payload: any, isSelf: boolean, raw: any) {
    const anchor = this.deps.getBaseAnchor?.(!isSelf);
    if (!anchor) return;
    const baseCard = this.findBaseCard(raw, payload.playerId);
    const start = this.getHandOrigin(isSelf);
    const stats = {
      ap: baseCard?.fieldCardValue?.totalAP ?? 0,
      hp: baseCard?.fieldCardValue?.totalHP ?? 0,
    };
    const textureKey = baseCard ? toPreviewKey(baseCard.cardId ?? baseCard.id) : undefined;
    void this.deps.playAnimator.play({
      textureKey,
      fallbackLabel: baseCard?.cardId ?? payload.carduid,
      start,
      end: { x: anchor.x, y: anchor.y },
      isOpponent: !isSelf,
      cardName: baseCard?.cardData?.name ?? baseCard?.cardId ?? "Base",
      stats,
      size: anchor.w && anchor.h ? { w: anchor.w, h: anchor.h } : undefined,
    });
  }

  private animateCommand(payload: any, isSelf: boolean, raw: any) {
    const cam = this.deps.scene.cameras.main;
    const start = this.getHandOrigin(isSelf);
    const end = { x: cam.centerX, y: cam.centerY };
    const card = this.findCardByUid(raw, payload.carduid);
    const stats = {
      ap: card?.cardData?.ap ?? 0,
      hp: card?.cardData?.hp ?? 0,
    };
    void this.deps.playAnimator.play({
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

  private findBaseCard(raw: any, playerId?: string) {
    const players = raw?.gameEnv?.players || {};
    const player = playerId ? players[playerId] : undefined;
    if (!player) return undefined;
    const zones = player.zones || player.zone || {};
    const baseArr = zones.base || player.base;
    if (Array.isArray(baseArr)) {
      return baseArr[0];
    }
    if (baseArr && typeof baseArr === "object") {
      return baseArr;
    }
    return undefined;
  }

  private findCardByUid(raw: any, cardUid?: string): SlotCardView | undefined {
    if (!cardUid) return undefined;
    const players = raw?.gameEnv?.players || {};
    const card = this.scanPlayersForCard(Object.values(players), cardUid);
    if (card) return card;
    return undefined;
  }

  private scanPlayersForCard(players: any[], targetUid: string): SlotCardView | undefined {
    for (const player of players) {
      if (!player) continue;
      const zones = player.zones || player.zone || {};
      for (const value of Object.values(zones)) {
        const match = this.extractCardFromZone(value, targetUid);
        if (match) return match;
      }
      const deck = player.deck;
      if (deck) {
        const areas = [deck.hand, deck.discard, deck.graveyard, deck.command, deck.processingQueue];
        for (const area of areas) {
          const match = this.extractCardFromZone(area, targetUid);
          if (match) return match;
        }
      }
    }
    return undefined;
  }

  private extractCardFromZone(zone: any, cardUid: string): SlotCardView | undefined {
    if (!zone) return undefined;
    if (Array.isArray(zone)) {
      for (const entry of zone) {
        const match = this.extractCardFromZone(entry, cardUid);
        if (match) return match;
      }
      return undefined;
    }
    if (typeof zone === "object") {
      if (zone.unit || zone.pilot) {
        return this.matchCard(zone.unit, cardUid) ?? this.matchCard(zone.pilot, cardUid);
      }
      return this.matchCard(zone, cardUid);
    }
    return undefined;
  }

  private matchCard(card: any, targetUid: string): SlotCardView | undefined {
    if (!card) return undefined;
    const uid = this.getCardUid(card);
    if (!uid || uid !== targetUid) return undefined;
    const id = typeof card === "string" ? card : card.cardId ?? card.id ?? uid;
    const textureKey = typeof card === "string" ? undefined : toPreviewKey(card.cardId ?? card.id ?? uid);
    return {
      id,
      textureKey,
      cardUid: uid,
      cardType: card.cardData?.cardType,
      cardData: card.cardData,
    };
  }

  private getCardUid(card: any) {
    if (!card) return undefined;
    if (typeof card === "string") return card;
    return card.carduid ?? card.cardUid ?? card.uid ?? card.id ?? card.cardId ?? undefined;
  }
}
