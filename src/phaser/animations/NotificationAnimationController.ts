import Phaser from "phaser";
import { PlayCardAnimationManager } from "./PlayCardAnimationManager";
import type { SlotViewModel, SlotCardView, SlotPositionMap, SlotOwner } from "../ui/SlotTypes";
import { toBaseKey, toPreviewKey, type HandCardView } from "../ui/HandTypes";
import { UI_LAYOUT } from "../ui/UiLayoutConfig";
import type { DrawPopupOpts } from "../ui/DrawPopupDialog";
import { getPilotDesignationStats, hasPilotDesignationRule } from "../utils/pilotDesignation";
import { createCardsMovedToDeckBottomTask, createTopDeckViewedTask } from "./deckNotificationTasks";
import { createCardsDrawnTask } from "./drawNotificationTasks";
import { createCommandPlayedTask } from "./commandNotificationTasks";
import { computeHandCardSize } from "../utils/handCardSizing";

export type SlotNotification = {
  id: string;
  type: string;
  payload?: Record<string, any>;
  metadata?: Record<string, any>;
};

type ProcessArgs = {
  slots: SlotViewModel[];
  boardSlotPositions?: SlotPositionMap;
  notificationQueue?: SlotNotification[];
  cardLookup?: {
    findBaseCard?: (playerId?: string) => any;
    findCardByUid?: (cardUid?: string) => SlotCardView | undefined;
  };
  allowAnimations: boolean;
  currentPlayerId: string | null;
  resolveSlotOwnerByPlayer?: (playerId?: string) => SlotOwner | undefined;
  shouldHideSlot?: (slotKey: string) => boolean;
};

export class NotificationAnimationController {
  private hiddenSlots = new Set<string>();
  private drawPopupTimings = {
    fadeInMs: 160,
    holdMs: 1500,
    fadeOutMs: 220,
  };

  constructor(
    private deps: {
      scene: Phaser.Scene;
      playAnimator: PlayCardAnimationManager;
      getBaseAnchor?: (isOpponent: boolean) =>
        | { x: number; y: number; isOpponent?: boolean; w?: number; h?: number }
        | undefined;
      getSlotAreaCenter?: (owner: "player" | "opponent") => { x: number; y: number } | undefined;
      renderHandPreview?: (container: Phaser.GameObjects.Container, card: HandCardView) => void;
      showCardPopup?: (
        card: any,
        opts: Pick<DrawPopupOpts, "header" | "fadeInMs" | "holdMs" | "fadeOutMs" | "centerY">,
      ) => Promise<void>;
      showCardsPopup?: (
        cards: any[],
        opts: Pick<DrawPopupOpts, "header" | "fadeInMs" | "holdMs" | "fadeOutMs" | "centerY">,
      ) => Promise<void>;
      getHandCardSize?: () => { w: number; h: number } | undefined;
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
    if (type !== "CARD_PLAYED_COMPLETED" && type !== "CARD_PLAYED") return Promise.resolve();
    const task = this.buildCardPlayedTask(note.payload ?? {}, args);
    if (!task) return Promise.resolve();
    return task();
  }

  playCardDrawn(note: SlotNotification, args: ProcessArgs): Promise<void> {
    const { allowAnimations } = args;
    if (!allowAnimations) return Promise.resolve();
    if (!note || !note.id) return Promise.resolve();
    const type = (note.type || "").toUpperCase();
    if (type !== "CARD_DRAWN" && type !== "CARD_ADDED_TO_HAND") return Promise.resolve();
    if (type === "CARD_DRAWN" && note.payload?.drawBatchId) {
      return Promise.resolve();
    }
    const header = type === "CARD_ADDED_TO_HAND" ? "Card Added to Hand" : "Card Drawn";
    const task = this.buildCardDrawnTask(note.payload ?? {}, args, header, type);
    if (!task) return Promise.resolve();
    return task();
  }

  playCardsDrawn(note: SlotNotification, args: ProcessArgs): Promise<void> {
    const { allowAnimations } = args;
    if (!allowAnimations) return Promise.resolve();
    if (!note || !note.id) return Promise.resolve();
    const type = (note.type || "").toUpperCase();
    if (type !== "CARDS_DRAWN") return Promise.resolve();
    const task = createCardsDrawnTask(note.payload ?? {}, args, {
      scene: this.deps.scene,
      showCardsPopup: this.deps.showCardsPopup,
      showCardPopup: this.deps.showCardPopup,
      timings: this.drawPopupTimings,
      buildPopupCardData: this.buildPopupCardData.bind(this),
    });
    if (!task) return Promise.resolve();
    return task();
  }

  playCardsMovedToTrash(note: SlotNotification, args: ProcessArgs): Promise<void> {
    const { allowAnimations } = args;
    if (!allowAnimations) return Promise.resolve();
    if (!note || !note.id) return Promise.resolve();
    const type = (note.type || "").toUpperCase();
    if (type !== "CARDS_MOVED_TO_TRASH") return Promise.resolve();
    const task = this.buildCardsMovedToTrashTask(note.payload ?? {}, args);
    if (!task) return Promise.resolve();
    return task();
  }

  playTopDeckViewed(note: SlotNotification, args: ProcessArgs): Promise<void> {
    const { allowAnimations } = args;
    if (!allowAnimations) return Promise.resolve();
    if (!note || !note.id) return Promise.resolve();
    const type = (note.type || "").toUpperCase();
    if (type !== "TOP_DECK_VIEWED") return Promise.resolve();
    const task = createTopDeckViewedTask(note.payload ?? {}, args, {
      scene: this.deps.scene,
      showCardsPopup: this.deps.showCardsPopup,
      showCardPopup: this.deps.showCardPopup,
      timings: this.drawPopupTimings,
    });
    if (!task) return Promise.resolve();
    return task();
  }

  playCardsMovedToDeckBottom(note: SlotNotification, args: ProcessArgs): Promise<void> {
    const { allowAnimations } = args;
    if (!allowAnimations) return Promise.resolve();
    if (!note || !note.id) return Promise.resolve();
    const type = (note.type || "").toUpperCase();
    if (type !== "CARDS_MOVED_TO_DECK_BOTTOM") return Promise.resolve();
    const task = createCardsMovedToDeckBottomTask(note.payload ?? {}, args, {
      scene: this.deps.scene,
      showCardsPopup: this.deps.showCardsPopup,
      showCardPopup: this.deps.showCardPopup,
      timings: this.drawPopupTimings,
      buildPopupCardData: this.buildPopupCardData.bind(this),
    });
    if (!task) return Promise.resolve();
    return task();
  }

  private buildCardDrawnTask(
    payload: any,
    ctx: ProcessArgs,
    header: string,
    eventType: string,
  ): (() => Promise<void>) | null {
    const playerId = payload?.playerId ?? "";
    if (!ctx.currentPlayerId || !playerId) return null;
    const isSelf = playerId === ctx.currentPlayerId;
    const reason = (payload?.reason ?? "").toString().toLowerCase();
    const isOpponentBurstAddToHand = !isSelf && eventType === "CARD_ADDED_TO_HAND" && reason === "burst";
    if (!isSelf && !isOpponentBurstAddToHand) return null;
    if (isOpponentBurstAddToHand) {
      const card = ctx.cardLookup?.findCardByUid?.(payload.carduid);
      const previewCard = this.buildPreviewCard(card);
      const fallbackCardId = payload?.cardId ?? payload?.carduid ?? "burst_card";
      const fallbackCardName = payload?.cardName ?? payload?.displayName ?? payload?.name ?? "Burst Card";
      const popupCard = card
        ? this.buildPopupCardData(card, payload.carduid)
        : {
            carduid: payload?.carduid,
            cardId: fallbackCardId,
            cardType: payload?.cardType ?? "command",
            textureKey: toBaseKey(fallbackCardId),
            cardData: {
              id: fallbackCardId,
              cardId: fallbackCardId,
              name: fallbackCardName,
              cardType: payload?.cardType ?? "command",
            },
          };
      return () =>
        this.showDrawPopup(
          previewCard ?? {
            color: 0x2a2d38,
            cardType: "command",
            textureKey: card?.textureKey,
            cardId: card?.id ?? fallbackCardId,
          },
          popupCard,
          "Burst - Opponent added card to hand",
        );
    }
    const card = ctx.cardLookup?.findCardByUid?.(payload.carduid);
    const previewCard = this.buildPreviewCard(card);
    const popupCard = this.buildPopupCardData(card, payload.carduid);
    return () =>
      this.showDrawPopup(
        previewCard ?? {
          color: 0x2a2d38,
          cardType: "command",
          textureKey: card?.textureKey,
          cardId: card?.id ?? payload.carduid,
        },
        popupCard,
        header,
      );
  }

  private buildCardsMovedToTrashTask(payload: any, ctx: ProcessArgs): (() => Promise<void>) | null {
    const cardUids: string[] = Array.isArray(payload?.carduids) ? payload.carduids.filter(Boolean).map(String) : [];
    const count = Number(payload?.count ?? cardUids.length);
    const total = cardUids.length || (Number.isFinite(count) ? Math.max(0, count) : 0);
    if (total <= 0) return null;

    const playerId = payload?.playerId ? String(payload.playerId) : "";
    const isSelf = !!ctx.currentPlayerId && playerId === ctx.currentPlayerId;
    const reveal = payload?.reveal === true;

    const popupCards = new Array(total).fill(null).map((_, idx) => {
      const uid = cardUids[idx];
      if (!uid || (!reveal && !isSelf)) {
        return {
          cardId: `hidden_trash_${payload?.timestamp ?? "event"}_${idx + 1}`,
          cardType: "command",
          cardData: { id: "hidden", name: "Hidden Card", cardType: "command" },
        };
      }
      const found = ctx.cardLookup?.findCardByUid?.(uid);
      return this.buildPopupCardData(found, uid);
    });

    const header = "Move to Trash";
    return async () => {
      const cam = this.deps.scene.cameras.main;
      if (this.deps.showCardsPopup) {
        await this.deps.showCardsPopup(popupCards, {
          header,
          fadeInMs: this.drawPopupTimings.fadeInMs,
          holdMs: this.drawPopupTimings.holdMs,
          fadeOutMs: this.drawPopupTimings.fadeOutMs,
          centerY: cam.centerY,
        });
        return;
      }
      // Fallback: show just the first card.
      await this.deps.showCardPopup?.(popupCards[0], {
        header,
        fadeInMs: this.drawPopupTimings.fadeInMs,
        holdMs: this.drawPopupTimings.holdMs,
        fadeOutMs: this.drawPopupTimings.fadeOutMs,
        centerY: cam.centerY,
      });
    };
  }

  private buildCardPlayedTask(payload: any, ctx: ProcessArgs): (() => Promise<void>) | null {
    const reason = (payload.reason ?? "").toString().toLowerCase();
    if (reason && reason !== "hand") return null;

    // Route based on play target (command/base/slot).
    const playAs = (payload.playAs ?? "").toString().toLowerCase();
    const isCompleted = payload?.isCompleted !== false;
    const playerId = payload.playerId ?? "";
    const isSelf = !!ctx.currentPlayerId && playerId === ctx.currentPlayerId;
    if (playAs === "command") {
      // Commands may not have a stable board representation; keep the prior behavior of animating only after completion.
      if (!isCompleted) return null;
      const card = ctx.cardLookup?.findCardByUid?.(payload.carduid);
      return createCommandPlayedTask(payload, isSelf, card, {
        animateCommand: this.animateCommand.bind(this),
        buildPopupCardData: this.buildPopupCardData.bind(this),
        buildPreviewCard: this.buildPreviewCard.bind(this),
        showCommandPopup: (preview, popupCard, header) => this.showDrawPopup(preview, popupCard, header),
      });
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
    const size = this.computeHandFlightSize();
    const end = { x: target.x, y: target.y };
    const cardName = card?.cardData?.name ?? card?.id ?? payload.carduid;
    const fallbackLabel = card?.id ?? payload.carduid;
    const textureKey = card?.textureKey;
    const shouldHide = ctx.shouldHideSlot ? ctx.shouldHideSlot(slotKey) : false;
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
        size,
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
    size?: { w: number; h: number };
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
        size: spec.size,
        preserveSize: true,
      });
    } finally {
      this.deps.onSlotAnimationEnd?.(spec.slotKey);
      if (spec.shouldHide) {
        // Show slot again after the animation completes.
        this.showSlot(spec.owner, spec.slotId);
      }
    }
  }

  private computeHandFlightSize() {
    const live = this.deps.getHandCardSize?.();
    if (live?.w && live?.h) return live;
    return computeHandCardSize(this.deps.scene.scale.width);
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
      angle: !isSelf ? 180 : 0,
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

  private showDrawPopup(card: HandCardView, popupCard?: any, header?: string) {
    const cam = this.deps.scene.cameras.main;
    const centerX = cam.centerX;
    const centerY = cam.centerY;
    if (this.deps.showCardPopup) {
      return this.deps.showCardPopup(popupCard ?? card, {
        header: header ?? "Card Drawn",
        fadeInMs: this.drawPopupTimings.fadeInMs,
        holdMs: this.drawPopupTimings.holdMs,
        fadeOutMs: this.drawPopupTimings.fadeOutMs,
        centerY,
      });
    }
    const container = this.deps.scene.add.container(centerX, centerY).setDepth(2100);
    const bg = this.deps.scene.add.rectangle(0, 0, 220, 200, 0x0f1118, 0.92);
    bg.setStrokeStyle(2, 0xffffff, 0.8);
    const title = this.deps.scene.add
      .text(0, -70, header ?? "Card Drawn", { fontSize: "18px", fontFamily: "Arial", color: "#ffffff" })
      .setOrigin(0.5);
    const cardContainer = this.deps.scene.add.container(0, 6);
    if (this.deps.renderHandPreview) {
      this.deps.renderHandPreview(cardContainer, card);
    } else {
      const texKey = (card.textureKey ? String(card.textureKey).replace(/-preview$/i, "") : undefined) ?? toBaseKey(card.cardId);
      const hasTexture = texKey && this.deps.scene.textures.exists(texKey);
      const fallback = hasTexture
        ? this.deps.scene.add.image(0, 0, texKey!).setDisplaySize(80, 112)
        : (this.deps.scene.add.rectangle(0, 0, 70, 96, 0x5e48f0, 0.95) as Phaser.GameObjects.Rectangle);
      cardContainer.add(fallback);
    }
    const previewW = UI_LAYOUT.hand.preview.cardWidth;
    const previewH = previewW * UI_LAYOUT.hand.preview.cardAspect;
    const maxCardW = 120;
    const maxCardH = 110;
    const scale = Math.min(maxCardW / previewW, maxCardH / previewH, 1);
    cardContainer.setScale(scale);
    container.add([bg, title, cardContainer]);
    container.setAlpha(0).setScale(0.88);

    return new Promise<void>((resolve) => {
      this.deps.scene.tweens.add({
        targets: container,
        alpha: 1,
        scale: 1,
        duration: this.drawPopupTimings.fadeInMs,
        ease: "Back.easeOut",
        onComplete: () => {
          this.deps.scene.time.delayedCall(this.drawPopupTimings.holdMs, () => {
            this.deps.scene.tweens.add({
              targets: container,
              alpha: 0,
              scale: 1.05,
              duration: this.drawPopupTimings.fadeOutMs,
              ease: "Sine.easeIn",
              onComplete: () => {
                container.destroy();
                resolve();
              },
            });
          });
        },
      });
    });
  }

  private buildPopupCardData(card?: SlotCardView, fallbackUid?: string) {
    if (!card) {
      return {
        cardId: fallbackUid ?? "card",
        cardType: "command",
        cardData: { cardId: fallbackUid ?? "card", cardType: "command" },
      };
    }
    const data = card.cardData ?? {};
    const cardType = data?.cardType ?? card.cardType;
    const cardId = data?.cardId ?? data?.id ?? card.id ?? fallbackUid;
    const baseTextureKey =
      (card.textureKey ? String(card.textureKey).replace(/-preview$/i, "") : undefined) ?? toBaseKey(cardId);
    return {
      cardId,
      cardType,
      cardData: { ...data, cardId, cardType },
      textureKey: baseTextureKey,
      fromPilotDesignation: cardType === "command" && hasPilotDesignationRule(data),
      ap: data?.ap,
      hp: data?.hp,
    };
  }

  private buildPreviewCard(card?: SlotCardView): HandCardView | null {
    if (!card) return null;
    const data = card.cardData ?? {};
    const pilotStats = getPilotDesignationStats(data);
    const cardType = data?.cardType ?? card.cardType;
    const isPilotCommand = cardType === "command" && hasPilotDesignationRule(data);
    const ap = isPilotCommand ? pilotStats?.ap ?? 0 : data?.ap ?? card.cardData?.ap;
    const hp = isPilotCommand ? pilotStats?.hp ?? 0 : data?.hp ?? card.cardData?.hp;
    const cardId = data?.cardId ?? data?.id ?? card.id;
    // Use full art for popups (non-preview) when possible.
    const textureKey = (card.textureKey ? String(card.textureKey).replace(/-preview$/i, "") : undefined) ?? toBaseKey(cardId);
    return {
      color: 0x2a2d38,
      textureKey,
      cost: data?.cost,
      ap,
      hp,
      cardType,
      cardId,
      fromPilotDesignation: isPilotCommand || data?.fromPilotDesignation === true,
    };
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

  
}
