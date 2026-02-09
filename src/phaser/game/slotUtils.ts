import { resolveCardUid } from "../utils/CardUid";

export const SLOT_KEYS = ["slot1", "slot2", "slot3", "slot4", "slot5", "slot6"] as const;

export function findPlayerSlotWithCardUid(raw: any, playerId: string, carduid: string) {
  const zones = raw?.gameEnv?.players?.[playerId]?.zones ?? {};
  for (const slotId of SLOT_KEYS) {
    const slot = zones?.[slotId];
    if (!slot) continue;
    const unitUid = resolveCardUid(slot?.unit);
    const pilotUid = resolveCardUid(slot?.pilot);
    if (unitUid === carduid || pilotUid === carduid) {
      return { slotId, slot };
    }
  }
  return undefined;
}

export function isCardLinkedInPlay(card: any, raw: any, playerId: string): boolean {
  const uid = resolveCardUid(card);
  if (!uid) return false;
  const found = findPlayerSlotWithCardUid(raw, playerId, uid);
  if (!found?.slot) return false;
  return !!found.slot.unit && !!found.slot.pilot;
}

