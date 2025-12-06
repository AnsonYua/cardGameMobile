import { HandCardView, toPreviewKey } from "./HandTypes";

export class HandPresenter {
  toHandCards(raw: any, playerId: string): HandCardView[] {
    const hand = raw?.gameEnv?.players?.[playerId]?.deck?.hand || [];
    if (!Array.isArray(hand) || hand.length === 0) return [];
    return hand.map((card: any) => {
      const id = typeof card === "string" ? card : card?.cardId;
      const textureKey = toPreviewKey(id);
      return { color: 0x2a2d38, textureKey };
    });
  }
}
