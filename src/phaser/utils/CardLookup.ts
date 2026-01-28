import { toPreviewKey } from "../ui/HandTypes";
import type { SlotCardView } from "../ui/SlotTypes";

export const findBaseCard = (raw: any, playerId?: string) => {
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
};

export const findCardByUid = (raw: any, cardUid?: string): SlotCardView | undefined => {
  if (!cardUid) return undefined;
  const players = raw?.gameEnv?.players || {};
  return scanPlayersForCard(Object.values(players), cardUid);
};

const scanPlayersForCard = (players: any[], targetUid: string): SlotCardView | undefined => {
  for (const player of players) {
    if (!player) continue;
    const zones = player.zones || player.zone || {};
    for (const value of Object.values(zones)) {
      const match = extractCardFromZone(value, targetUid);
      if (match) return match;
    }
    const deck = player.deck;
    if (deck) {
      const areas = [deck.hand, deck.discard, deck.graveyard, deck.command];
      for (const area of areas) {
        const match = extractCardFromZone(area, targetUid);
        if (match) return match;
      }
    }
  }
  return undefined;
};

const extractCardFromZone = (zone: any, cardUid: string): SlotCardView | undefined => {
  if (!zone) return undefined;
  if (Array.isArray(zone)) {
    for (const entry of zone) {
      const match = extractCardFromZone(entry, cardUid);
      if (match) return match;
    }
    return undefined;
  }
  if (typeof zone === "object") {
    if (zone.unit || zone.pilot) {
      return matchCard(zone.unit, cardUid) ?? matchCard(zone.pilot, cardUid);
    }
    return matchCard(zone, cardUid);
  }
  return undefined;
};

const matchCard = (card: any, targetUid: string): SlotCardView | undefined => {
  if (!card) return undefined;
  const uid = getCardUid(card);
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
};

const getCardUid = (card: any) => {
  if (!card) return undefined;
  if (typeof card === "string") return card;
  return card.carduid ?? card.cardUid ?? card.uid ?? card.id ?? card.cardId ?? undefined;
};
