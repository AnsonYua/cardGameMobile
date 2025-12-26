import type { SlotViewModel, SlotOwner, SlotPositionMap, SlotPosition } from "../ui/SlotTypes";

export type TargetAnchorProviders = {
  getBaseAnchor?: (isOpponent: boolean) => { x: number; y: number } | undefined;
  getShieldAnchor?: (isOpponent: boolean) => { x: number; y: number } | undefined;
};

export type TargetResolutionContext = {
  resolveSlotOwnerByPlayer: (playerId?: string) => SlotOwner | undefined;
  anchors: TargetAnchorProviders;
};

export function findSlotForAttack(slots: SlotViewModel[], cardUid?: string, owner?: SlotOwner, fallbackSlot?: string) {
  if (cardUid) {
    const found = slots.find((slot) => slot.unit?.cardUid === cardUid || slot.pilot?.cardUid === cardUid);
    if (found) return found;
  }
  if (owner && fallbackSlot) {
    return slots.find((slot) => slot.owner === owner && slot.slotId === fallbackSlot);
  }
  return undefined;
}

export function getSlotPositionEntry(
  positions?: SlotPositionMap | null,
  slot?: SlotViewModel,
  owner?: SlotOwner,
  fallbackSlotId?: string,
): SlotPosition | undefined {
  if (!positions) return undefined;
  const resolvedOwner = slot?.owner ?? owner;
  const slotId = slot?.slotId ?? fallbackSlotId;
  if (!resolvedOwner || !slotId) return undefined;
  return positions[resolvedOwner]?.[slotId];
}

export function getSlotCenterFromMap(
  positions?: SlotPositionMap | null,
  slot?: SlotViewModel,
  owner?: SlotOwner,
  fallbackSlotId?: string,
) {
  const entry = getSlotPositionEntry(positions, slot, owner, fallbackSlotId);
  if (!entry) return undefined;
  return { x: entry.x, y: entry.y };
}

export function resolveAttackTargetPoint(
  payload: any,
  slots: SlotViewModel[],
  positions: SlotPositionMap | null | undefined,
  defenderOwner: SlotOwner,
  context: TargetResolutionContext,
) {
  const targetSlotId = payload.forcedTargetZone ?? payload.targetSlotName ?? payload.targetSlot ?? undefined;
  const normalizedSlot = (targetSlotId ?? "").toLowerCase();
  const normalizedName = (payload.targetName ?? "").toLowerCase();
  const targetPlayerId = payload.forcedTargetPlayerId ?? payload.targetPlayerId ?? payload.defendingPlayerId;
  const targetOwner = context.resolveSlotOwnerByPlayer(targetPlayerId) ?? defenderOwner;
  const isOpponentTarget = targetOwner === "opponent";

  if (isBaseTarget(normalizedSlot, normalizedName)) {
    const anchor = context.anchors.getBaseAnchor?.(isOpponentTarget);
    if (anchor) {
      return { x: anchor.x, y: anchor.y };
    }
  }

  if (isShieldTarget(normalizedSlot, normalizedName)) {
    const anchor = context.anchors.getShieldAnchor?.(isOpponentTarget);
    if (anchor) {
      return anchor;
    }
    const fallbackAnchor = context.anchors.getBaseAnchor?.(isOpponentTarget);
    if (fallbackAnchor) {
      return { x: fallbackAnchor.x, y: fallbackAnchor.y };
    }
  }

  const targetCarduid = payload.forcedTargetCarduid ?? payload.targetCarduid ?? payload.targetUnitUid;
  const slotVm = findSlotForAttack(slots, targetCarduid, targetOwner, targetSlotId);
  return getSlotCenterFromMap(positions, slotVm, targetOwner, targetSlotId);
}

function isBaseTarget(normalizedSlot: string, normalizedName: string) {
  return normalizedSlot === "base" || normalizedName === "base";
}

function isShieldTarget(normalizedSlot: string, normalizedName: string) {
  return normalizedSlot === "shield" || normalizedName.includes("shield");
}
