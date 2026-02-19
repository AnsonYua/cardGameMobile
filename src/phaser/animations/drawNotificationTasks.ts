import type Phaser from "phaser";

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
  buildPopupCardData: (card: any, fallbackUid?: string) => PopupCard;
};

type DrawTaskContext = {
  currentPlayerId: string | null;
  cardLookup?: { findCardByUid?: (cardUid?: string) => any };
};

export function createCardsDrawnTask(
  payload: any,
  ctx: DrawTaskContext,
  deps: PopupDeps,
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
    return {
      cardId: uid || `drawn_hidden_${payload?.timestamp ?? "event"}_${idx + 1}`,
      cardType: "command",
      cardData: {
        id: "hidden",
        cardId: uid || "hidden",
        name: "Unknown Card",
        cardType: "command",
      },
    };
  });

  const header = "Cards Drawn";
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
