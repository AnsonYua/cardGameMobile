import type { HandCardView } from "./HandTypes";

export function toTextureKey(textureKey?: string) {
  if (!textureKey) return undefined;
  return textureKey.replace(/-preview$/, "");
}

export function getBadgeLabel(card: HandCardView) {
  if (!card) return undefined;
  const type = (card.cardType || "").toLowerCase();
  if (type === "command") {
    if (!card.fromPilotDesignation) return undefined;
    const ap = Number(card.ap ?? 0);
    const hp = Number(card.hp ?? 0);
    return `${ap}|${hp}`;
  }
  if (type === "unit" || type === "pilot" || type === "base" || card.fromPilotDesignation) {
    const ap = Number(card.ap ?? 0);
    const hp = Number(card.hp ?? 0);
    return `${ap}|${hp}`;
  }
  return undefined;
}
