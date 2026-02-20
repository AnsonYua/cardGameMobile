import type { HandCardView } from "./HandTypes";
import { getCardStatsLabel } from "./DialogCardRenderUtils";

export function toTextureKey(textureKey?: string) {
  if (!textureKey) return undefined;
  return textureKey.replace(/-preview$/, "");
}

export function getBadgeLabel(card: HandCardView) {
  if (!card) return undefined;
  return getCardStatsLabel(card, { ap: card.ap, hp: card.hp });
}
