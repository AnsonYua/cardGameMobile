import type Phaser from "phaser";
import { toBaseKey } from "../ui/HandTypes";
import { findTopDeckViewedCard } from "../utils/TutorNotificationUtils";

type PopupCard = any;

type PopupDeps = {
  scene: Phaser.Scene;
  showCardsPopup?: (
    cards: any[],
    opts: { header?: string; fadeInMs?: number; holdMs?: number; fadeOutMs?: number; centerY?: number },
  ) => Promise<void>;
  showCardPopup?: (
    card: any,
    opts: { header?: string; fadeInMs?: number; holdMs?: number; fadeOutMs?: number; centerY?: number },
  ) => Promise<void>;
  timings: { fadeInMs: number; holdMs: number; fadeOutMs: number };
};

type SlotNotificationLike = { type?: string; payload?: any };

function buildPopupCardDataFromPartial(entry: any, opts: { preferPreview?: boolean } = {}): PopupCard {
  const cardId = entry?.cardId ?? entry?.id ?? entry?.carduid ?? entry?.cardUid ?? "card";
  const textureKey = toBaseKey(String(cardId));
  const name = entry?.name ?? entry?.cardData?.name;
  const traits = Array.isArray(entry?.traits) ? entry.traits : entry?.cardData?.traits;
  const cardType = entry?.cardType ?? entry?.cardData?.cardType ?? "command";
  return {
    cardId,
    cardType,
    cardData: {
      ...(entry?.cardData ?? {}),
      id: entry?.id ?? entry?.cardData?.id ?? cardId,
      cardId,
      name,
      traits,
      cardType,
    },
    textureKey,
    preferPreview: opts.preferPreview,
  };
}

export function createTopDeckViewedTask(
  payload: any,
  ctx: { currentPlayerId: string | null },
  deps: PopupDeps,
): (() => Promise<void>) | null {
  const playerId = payload?.playerId ? String(payload.playerId) : "";
  if (!ctx.currentPlayerId || playerId !== ctx.currentPlayerId) return null;
  const cards = Array.isArray(payload?.cards) ? payload.cards.filter(Boolean) : [];
  const count = Number(payload?.count ?? cards.length);
  const total = cards.length || (Number.isFinite(count) ? Math.max(0, count) : 0);
  if (total <= 0) return null;

  const popupCards = new Array(total).fill(null).map((_, idx) => {
    const entry: any = cards[idx];
    if (!entry) {
      return {
        cardId: `hidden_top_${payload?.timestamp ?? "event"}_${idx + 1}`,
        cardType: "command",
        cardData: { id: "hidden", name: "Hidden Card", cardType: "command" },
      };
    }
    // Reveal-style popup: prefer full art (non "-preview") when available.
    return buildPopupCardDataFromPartial(entry, { preferPreview: false });
  });

  const header = "Top of Deck";
  return async () => {
    const cam = deps.scene.cameras.main;
    if (deps.showCardsPopup) {
      await deps.showCardsPopup(popupCards, {
        header,
        fadeInMs: deps.timings.fadeInMs,
        holdMs: deps.timings.holdMs,
        fadeOutMs: deps.timings.fadeOutMs,
        centerY: cam.centerY,
      });
      return;
    }
    await deps.showCardPopup?.(popupCards[0], {
      header,
      fadeInMs: deps.timings.fadeInMs,
      holdMs: deps.timings.holdMs,
      fadeOutMs: deps.timings.fadeOutMs,
      centerY: cam.centerY,
    });
  };
}

export function createCardsMovedToDeckBottomTask(
  payload: any,
  ctx: {
    currentPlayerId: string | null;
    notificationQueue?: SlotNotificationLike[];
    cardLookup?: { findCardByUid?: (cardUid?: string) => any };
  },
  deps: PopupDeps & { buildPopupCardData: (card: any, fallbackUid?: string) => PopupCard },
): (() => Promise<void>) | null {
  const playerId = payload?.playerId ? String(payload.playerId) : "";
  if (!ctx.currentPlayerId || playerId !== ctx.currentPlayerId) return null;
  const cardUids: string[] = Array.isArray(payload?.carduids) ? payload.carduids.filter(Boolean).map(String) : [];
  const count = Number(payload?.count ?? cardUids.length);
  const total = cardUids.length || (Number.isFinite(count) ? Math.max(0, count) : 0);
  if (total <= 0) return null;

  const popupCards = new Array(total).fill(null).map((_, idx) => {
    const uid = cardUids[idx];
    const found = uid ? ctx.cardLookup?.findCardByUid?.(uid) : undefined;
    if (found) return deps.buildPopupCardData(found, uid);
    const partial = uid
      ? findTopDeckViewedCard(ctx.notificationQueue ?? [], {
          playerId: payload?.playerId,
          effectId: payload?.effectId,
          cardUid: uid,
        })
      : undefined;
    if (partial) return buildPopupCardDataFromPartial(partial);
    return {
      cardId: uid || `hidden_bottom_${payload?.timestamp ?? "event"}_${idx + 1}`,
      cardType: "command",
      cardData: { id: "hidden", name: "Unknown Card", cardType: "command" },
    };
  });

  const header = "Put on Bottom";
  const holdMs = Math.min(1200, Math.max(650, Math.floor(deps.timings.holdMs * 0.7)));
  return async () => {
    const cam = deps.scene.cameras.main;
    if (deps.showCardsPopup) {
      await deps.showCardsPopup(popupCards, {
        header,
        fadeInMs: deps.timings.fadeInMs,
        holdMs,
        fadeOutMs: deps.timings.fadeOutMs,
        centerY: cam.centerY,
      });
      return;
    }
    await deps.showCardPopup?.(popupCards[0], {
      header,
      fadeInMs: deps.timings.fadeInMs,
      holdMs,
      fadeOutMs: deps.timings.fadeOutMs,
      centerY: cam.centerY,
    });
  };
}
