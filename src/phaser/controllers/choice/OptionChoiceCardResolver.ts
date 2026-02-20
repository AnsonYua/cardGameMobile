import { findCardByUid } from "../../utils/CardLookup";
import { findTopDeckViewedCard } from "../../utils/TutorNotificationUtils";

export function resolveOptionCardId(raw: any, option: any): string | undefined {
  const payload = option?.payload ?? {};
  const direct = payload?.cardId ?? payload?.sourceCardId ?? payload?.source?.cardId ?? option?.cardId;
  if (direct) return String(direct);

  const uid =
    payload?.carduid ??
    payload?.cardUid ??
    payload?.sourceCarduid ??
    payload?.sourceCardUid ??
    payload?.source?.carduid ??
    payload?.source?.cardUid;
  if (uid) {
    const lookup = findCardByUid(raw, String(uid));
    if (lookup?.id) return String(lookup.id);
    const byTopDeckView = findTopDeckViewedCard(raw?.gameEnv?.notificationQueue ?? raw?.notificationQueue ?? [], {
      cardUid: String(uid),
    });
    const viewedCardId = byTopDeckView?.cardId ?? byTopDeckView?.id;
    if (viewedCardId) return String(viewedCardId);
  }

  const label = (option?.label ?? "").toString();
  const tutorCardId = extractTutorCardId(label);
  if (tutorCardId) return tutorCardId;
  const name = extractCardName(label);
  if (!name) return undefined;
  const byName = findCardByName(raw, name);
  return byName?.id ? String(byName.id) : undefined;
}

function extractTutorCardId(label: string): string | undefined {
  // Handles labels like: "Reveal and add ST03-001 to hand"
  const m = label.match(/\b([A-Z]{1,4}\d{0,2}-\d{3})\b/);
  return m?.[1];
}

function extractCardName(label: string): string | undefined {
  const idx = label.indexOf(":");
  if (idx <= 0) return undefined;
  const name = label.slice(0, idx).trim();
  return name.length ? name : undefined;
}

function findCardByName(raw: any, name: string): { id?: string; cardUid?: string } | undefined {
  const players = raw?.gameEnv?.players || {};
  const values = Object.values(players);
  for (const player of values) {
    if (!player) continue;
    const zones = (player as any).zones || (player as any).zone || {};
    for (const zone of Object.values(zones)) {
      const match = findCardByNameInZone(zone, name);
      if (match) return match;
    }
    const deck = (player as any).deck;
    if (deck) {
      const areas = [deck.hand, deck.discard, deck.graveyard, deck.command];
      for (const area of areas) {
        const match = findCardByNameInZone(area, name);
        if (match) return match;
      }
    }
  }
  return undefined;
}

function findCardByNameInZone(zone: any, name: string): { id?: string; cardUid?: string } | undefined {
  if (!zone) return undefined;
  if (Array.isArray(zone)) {
    for (const entry of zone) {
      const match = findCardByNameInZone(entry, name);
      if (match) return match;
    }
    return undefined;
  }
  if (typeof zone !== "object") return undefined;
  if (zone.unit || zone.pilot) {
    return findCardByNameInZone(zone.unit, name) ?? findCardByNameInZone(zone.pilot, name);
  }
  const cardDataName = (zone?.cardData?.name ?? "").toString();
  if (cardDataName && cardDataName === name) {
    const id = (zone.cardId ?? zone.id ?? "").toString() || undefined;
    const cardUid = (zone.carduid ?? zone.cardUid ?? "").toString() || undefined;
    return { id, cardUid };
  }
  return undefined;
}
