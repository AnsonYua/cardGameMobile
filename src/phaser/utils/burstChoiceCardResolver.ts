import { findCardByUid } from "./CardLookup";

export function resolveBurstChoiceCard(raw: any, opts: { carduid?: string; availableTargets?: any[] }) {
  const carduid = opts.carduid;
  const targets = Array.isArray(opts.availableTargets) ? opts.availableTargets : [];
  if (carduid) {
    const match = targets.find((t: any) => t?.carduid === carduid);
    if (match) return match;
    const lookup = findCardByUid(raw, carduid);
    if (lookup) {
      return {
        carduid: lookup.cardUid ?? carduid,
        cardId: lookup.id,
        cardData: lookup.cardData,
      };
    }
  }
  return targets[0];
}

