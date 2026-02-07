import type { SlotNotification } from "./NotificationAnimationController";

export const extractCardUidsFromNotification = (note: SlotNotification): string[] => {
  const payload = note.payload || {};
  const candidates = [
    payload.carduid,
    payload.cardUid,
    payload.attackerCarduid,
    payload.attackerUnitUid,
    payload.targetCarduid,
    payload.targetUnitUid,
    payload.forcedTargetCarduid,
    payload?.attacker?.carduid,
    payload?.attacker?.cardUid,
    payload?.target?.carduid,
    payload?.target?.cardUid,
    payload?.attacker?.unit?.carduid,
    payload?.attacker?.unit?.cardUid,
    payload?.attacker?.pilot?.carduid,
    payload?.attacker?.pilot?.cardUid,
    payload?.target?.unit?.carduid,
    payload?.target?.unit?.cardUid,
    payload?.target?.pilot?.carduid,
    payload?.target?.pilot?.cardUid,
  ];
  const uids = new Set<string>();
  candidates.forEach((value) => {
    if (typeof value === "string" && value.trim()) {
      uids.add(value);
    }
  });
  return Array.from(uids);
};
