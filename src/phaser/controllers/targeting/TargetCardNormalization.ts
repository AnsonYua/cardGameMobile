export function getTargetCardCore(target: any): Record<string, any> | undefined {
  const cardData = target?.cardData && typeof target.cardData === "object" ? target.cardData : undefined;
  const nested = cardData?.cardData && typeof cardData.cardData === "object" ? cardData.cardData : undefined;
  return nested ?? cardData;
}

function extractCardIdFromUid(uid: unknown): string | undefined {
  if (typeof uid !== "string") return undefined;
  const value = uid.trim();
  if (!value) return undefined;

  const zoneMarkers = [
    "_shield_",
    "_hand_",
    "_deck_",
    "_trash_",
    "_base_",
    "_slot1_",
    "_slot2_",
    "_slot3_",
    "_slot4_",
    "_slot5_",
    "_slot6_",
    "_energy_",
    "_friendly_",
    "_enemy_",
  ];
  for (const marker of zoneMarkers) {
    const idx = value.indexOf(marker);
    if (idx > 0) return value.slice(0, idx);
  }

  return undefined;
}

export function getTargetCardId(target: any): string | undefined {
  const core = getTargetCardCore(target);
  const fromUid =
    extractCardIdFromUid(target?.carduid) ??
    extractCardIdFromUid(target?.cardUid) ??
    extractCardIdFromUid(target?.uid);
  const candidates = [
    core?.id,
    target?.cardId,
    core?.cardId,
    target?.cardData?.cardData?.id,
    fromUid,
    target?.carduid,
    target?.cardUid,
    target?.uid,
    target?.id,
  ];
  for (const value of candidates) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
}

export function normalizeTargetForRender(target: any): any {
  const cardCore = getTargetCardCore(target);
  if (!cardCore) return target;
  if (target.cardData === cardCore) return target;
  return {
    ...target,
    cardData: cardCore,
  };
}
