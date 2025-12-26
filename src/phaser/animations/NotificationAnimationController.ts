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
  notifications: SlotNotification[];
  slots: SlotViewModel[];
  slotPositions?: SlotPositionMap;
  slotAreaCenter?: (owner: "player" | "opponent") => { x: number; y: number } | undefined;
  raw: any;
  allowAnimations: boolean;
  currentPlayerId: string | null;
  shouldHideSlot?: (slotKey: string) => boolean;
};

export class NotificationAnimationController {
  private processedIds = new Set<string>();
  private animationQueue: Promise<void> = Promise.resolve();
  private hiddenSlots = new Set<string>();
  private lockedSlotSnapshots = new Map<string, SlotViewModel>();

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

  resetProcessed() {
    this.processedIds.clear();
  }

  process(args: ProcessArgs): Promise<void> {
    const { notifications, allowAnimations } = args;

    if (!notifications?.length) return this.animationQueue;

    if (!allowAnimations) {
      return this.animationQueue;
    }

    notifications.forEach((note) => {
      if (!note || !note.id || this.processedIds.has(note.id)) return;
      const type = (note.type || "").toUpperCase();
      if (type === "CARD_PLAYED") {
        const task = this.buildCardPlayedTask(note.payload ?? {}, args);
        if (!task) return;
        this.processedIds.add(note.id);
        this.enqueueAnimation(note.id, task);
      }
    });
    return this.animationQueue;
  }

  private enqueueAnimation(id: string, task: () => Promise<void>) {
    // eslint-disable-next-line no-console
    console.log("[NotificationAnimator] enqueue", id, Date.now());
    this.animationQueue = this.animationQueue
      .then(async () => {
        // eslint-disable-next-line no-console
        console.log("[NotificationAnimator] start", id, Date.now());
        await task();
        // eslint-disable-next-line no-console
        console.log("[NotificationAnimator] complete", id, Date.now());
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.warn("[NotificationAnimator] animation task failed", err);
      });
  }

  private buildCardPlayedTask(payload: any, ctx: ProcessArgs): (() => Promise<void>) | null {
    if (!payload?.isCompleted) return null;
    const reason = (payload.reason ?? "").toString().toLowerCase();
    if (reason && reason !== "hand") return null;

    const playAs = (payload.playAs ?? "").toString().toLowerCase();
    const playerId = payload.playerId ?? "";
    const isSelf = !!ctx.currentPlayerId && playerId === ctx.currentPlayerId;
    if (playAs === "command") {
      return () => this.animateCommand(payload, isSelf, ctx);
    }
    if (playAs === "base") {
      return () => this.animateBase(payload, isSelf, ctx.raw);
    }
    const slotTask = this.buildSlotAnimationTask(payload, isSelf, ctx);
    if (slotTask) {
      return slotTask;
    }
    return null;
  }

  private buildSlotAnimationTask(payload: any, isSelf: boolean, ctx: ProcessArgs): (() => Promise<void>) | null {
    const { slots, slotPositions } = ctx;
    if (!slotPositions) return null;
    const slot = this.findSlot(slots, payload.carduid);
    if (!slot) return null;
    let target = slotPositions[slot.owner]?.[slot.slotId];
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
    if (shouldHide) {
      this.lockSlotSnapshot(slotKey, slot);
    }
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
        this.showSlot(spec.owner, spec.slotId);
      }
      this.releaseSlotSnapshot(spec.slotKey);
    }
  }

  private async animateBase(payload: any, isSelf: boolean, raw: any) {
    //if the base is opponent, the card should rotate 180
    const anchor = this.deps.getBaseAnchor?.(!isSelf);
    if (!anchor) return;
    const baseCard = this.findBaseCard(raw, payload.playerId);
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

  private animateCommand(payload: any, isSelf: boolean, ctx: ProcessArgs) {
    //if it is opponent , the end poistion should go to opponent slot center
    const cam = this.deps.scene.cameras.main;
    const start = this.getHandOrigin(isSelf);
    const opponentCenter = this.deps.getSlotAreaCenter?.("opponent");
    const end =
      !isSelf && opponentCenter
        ? { x: opponentCenter.x, y: opponentCenter.y }
        : { x: cam.centerX, y: cam.centerY };
    const card = this.findCardByUid(ctx.raw, payload.carduid);
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

  private hideSlot(owner?: SlotOwner, slotId?: string) {
    if (!owner || !slotId) return;
    const key = `${owner}-${slotId}`;
    if (this.hiddenSlots.has(key)) return;
    this.deps.setSlotVisible?.(owner, slotId, false);
    this.hiddenSlots.add(key);
  }

  private showSlot(owner?: SlotOwner, slotId?: string) {
    if (!owner || !slotId) return;
    const key = `${owner}-${slotId}`;
    if (!this.hiddenSlots.has(key)) return;
    this.hiddenSlots.delete(key);
    this.deps.setSlotVisible?.(owner, slotId, true);
  }

  private lockSlotSnapshot(slotKey: string, slot: SlotViewModel) {
    if (!slotKey) return;
    const snapshot: SlotViewModel = {
      owner: slot.owner,
      slotId: slot.slotId,
      unit: slot.unit ? { ...slot.unit } : undefined,
      pilot: slot.pilot ? { ...slot.pilot } : undefined,
      isRested: slot.isRested,
      ap: slot.ap,
      hp: slot.hp,
      fieldCardValue: slot.fieldCardValue ? { ...slot.fieldCardValue } : undefined,
    };
    this.lockedSlotSnapshots.set(slotKey, snapshot);
    // eslint-disable-next-line no-console
    console.log("[NotificationAnimator] lockSlot", slotKey, snapshot.unit?.cardUid ?? snapshot.pilot?.cardUid ?? null);
  }

  private releaseSlotSnapshot(slotKey: string) {
    if (!slotKey) return;
    this.lockedSlotSnapshots.delete(slotKey);
    // eslint-disable-next-line no-console
    console.log("[NotificationAnimator] unlockSlot", slotKey);
  }

  getLockedSlots() {
    return new Map(this.lockedSlotSnapshots);
  }

  private getCardUid(card: any) {
    if (!card) return undefined;
    if (typeof card === "string") return card;
    return card.carduid ?? card.cardUid ?? card.uid ?? card.id ?? card.cardId ?? undefined;
  }
}
