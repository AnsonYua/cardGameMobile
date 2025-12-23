import type { SlotPresenter } from "../ui/SlotPresenter";
import type { SlotViewModel, SlotOwner } from "../ui/SlotTypes";

export type ActionTargetEntry = {
  carduid?: string;
  cardUid?: string;
  cardId?: string;
  cardName?: string;
  cardType?: string;
  location?: string;
  zone?: string;
  zoneType?: string;
  playerId?: string;
};

export function getBattleFromRaw(raw?: any) {
  const battle = raw?.gameEnv?.currentBattle ?? raw?.gameEnv?.currentbattle;
  if (!battle) return undefined;
  const status = (battle?.status || "").toString().toUpperCase();
  if (status !== "ACTION_STEP") return undefined;
  return battle;
}

export function getActionTargetsForPlayer(battle?: any, playerId?: string) {
  if (!battle) return [];
  const targetPlayer = playerId ?? "";
  const candidate = battle?.actionTargets?.[targetPlayer];
  return Array.isArray(candidate) ? candidate : [];
}

export function getSlotBySelection(
  selection: { slotId?: string; owner?: SlotOwner } | undefined,
  raw: any,
  slotPresenter: SlotPresenter,
  playerId?: string,
) {
  if (!selection?.slotId || !selection.owner) return undefined;
  const selfId = playerId || "";
  const slots = slotPresenter.toSlots(raw, selfId);
  return slots.find((s) => s.slotId === selection.slotId && s.owner === selection.owner);
}

export function selectionMatchesActionTarget(
  selection: any,
  targets: ActionTargetEntry[],
  raw: any,
  slotPresenter: SlotPresenter,
  playerId?: string,
) {
  if (!selection || !targets.length) return false;
  if (selection.kind === "hand") {
    const uid = selection.uid || selection.carduid || selection.cardUid;
    if (matchesAnyActionTargetUid(uid, targets)) return true;
    return targets.some((target) => zoneIsHand(target));
  }
  if (selection.kind === "slot") {
    const slot = getSlotBySelection(selection, raw, slotPresenter, playerId);
    return slotMatchesActionTarget(slot, targets);
  }
  return false;
}

export function handCardMatchesActionTarget(uid: string | undefined, targets: ActionTargetEntry[]) {
  if (!uid || !targets.length) return false;
  if (matchesAnyActionTargetUid(uid, targets)) return true;
  return targets.some((target) => zoneIsHand(target));
}

export function slotMatchesActionTarget(slot: SlotViewModel | undefined, targets: ActionTargetEntry[]) {
  if (!slot || !targets.length) return false;
  return targets.some((target) => {
    if (cardUidMatchesActionTarget(slot.unit?.cardUid, target)) return true;
    if (cardUidMatchesActionTarget(slot.pilot?.cardUid, target)) return true;
    return zoneMatchesSlot(slot.slotId, target);
  });
}

export function matchesAnyActionTargetUid(uid: string | undefined, targets: ActionTargetEntry[]) {
  if (!uid) return false;
  return targets.some((target) => cardUidMatchesActionTarget(uid, target));
}

export function cardUidMatchesActionTarget(uid: string | undefined, target?: ActionTargetEntry) {
  if (!uid || !target) return false;
  const targetUid = (target.carduid || target.cardUid || target.cardId || target.cardName)?.toString();
  if (!targetUid) return false;
  return uid === targetUid;
}

export function zoneMatchesSlot(slotId?: string, target?: ActionTargetEntry) {
  if (!slotId || !target) return false;
  const normalizedSlot = slotId.toString().toLowerCase();
  const zoneValues = [target.zone, target.location, target.zoneType];
  return zoneValues.some((zone) => normalizeZone(zone) === normalizedSlot);
}

export function zoneIsHand(target?: ActionTargetEntry) {
  const zone = normalizeZone(target?.zone || target?.location || target?.zoneType);
  return zone === "hand" || zone === "handarea";
}

export function normalizeZone(zone?: string) {
  return zone?.toString().trim().toLowerCase() || "";
}
