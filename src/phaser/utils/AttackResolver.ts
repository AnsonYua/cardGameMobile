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
  const targetSlotId =
    payload.forcedTargetZone ??
    payload.targetSlotName ??
    payload.targetSlot ??
    payload.target?.slot ??
    undefined;
  const battleType = (payload.battleType ?? "").toString().toLowerCase();
  const targetZoneType = (payload.target?.zoneType ?? payload.targetZoneType ?? "").toString().toLowerCase();
  const inferredSlot =
    battleType.includes("shield") || targetZoneType.includes("shield")
      ? "shield"
      : battleType.includes("base") || targetZoneType.includes("base")
      ? "base"
      : "";
  const normalizedSlot = (targetSlotId ?? inferredSlot).toLowerCase();
  const normalizedName = (
    payload.targetName ??
    payload.target?.unit?.cardData?.name ??
    payload.target?.unit?.cardId ??
    ""
  ).toLowerCase();
  const hasForcedTarget = Boolean(payload.forcedTargetCarduid || payload.forcedTargetZone || payload.forcedTargetPlayerId);
  const targetPlayerId =
    payload.forcedTargetPlayerId ??
    payload.targetPlayerId ??
    payload.defendingPlayerId ??
    payload.target?.playerId;
  const targetOwner = context.resolveSlotOwnerByPlayer(targetPlayerId) ?? defenderOwner;
  const isOpponentTarget = targetOwner === "opponent";

  const isBase = isBaseTarget(normalizedSlot, normalizedName);
  const isShield = isShieldTarget(normalizedSlot, normalizedName);
  // eslint-disable-next-line no-console
  console.log("[AttackResolver] target resolution", {
    targetSlotId,
    normalizedSlot,
    normalizedName,
    battleType,
    targetZoneType,
    hasForcedTarget,
    targetOwner,
    isBase,
    isShield,
  });

  if (isBase) {
    const anchor = context.anchors.getBaseAnchor?.(isOpponentTarget);
    if (anchor) {
      return { x: anchor.x, y: anchor.y };
    }
    // eslint-disable-next-line no-console
    console.log("[AttackResolver] base target without anchor", {
      targetSlotId,
      targetName: normalizedName,
      targetOwner,
    });
  }

  if (isShield) {
    const anchor = context.anchors.getShieldAnchor?.(isOpponentTarget);
    if (anchor) {
      // eslint-disable-next-line no-console
      console.log(
        `[AttackResolver] shield anchor isOpponentTarget=${isOpponentTarget} x=${anchor.x} y=${anchor.y}`,
      );
      return anchor;
    }
    const fallbackAnchor = context.anchors.getBaseAnchor?.(isOpponentTarget);
    if (fallbackAnchor) {
      // eslint-disable-next-line no-console
      console.log(
        `[AttackResolver] shield fallback anchor isOpponentTarget=${isOpponentTarget} x=${fallbackAnchor.x} y=${fallbackAnchor.y}`,
      );
      return { x: fallbackAnchor.x, y: fallbackAnchor.y };
    }
    // eslint-disable-next-line no-console
    console.log("[AttackResolver] shield target without anchor", {
      targetSlotId,
      targetName: normalizedName,
      targetOwner,
    });
  }

  const targetCarduid =
    payload.forcedTargetCarduid ??
    payload.targetCarduid ??
    payload.targetUnitUid ??
    payload.target?.unit?.carduid ??
    payload.target?.carduid;
  const slotVm = findSlotForAttack(slots, targetCarduid, targetOwner, targetSlotId);
  return getSlotCenterFromMap(positions, slotVm, targetOwner, targetSlotId);
}

function isBaseTarget(normalizedSlot: string, normalizedName: string) {
  return normalizedSlot === "base" || normalizedName === "base";
}

function isShieldTarget(normalizedSlot: string, normalizedName: string) {
  return normalizedSlot.includes("shield") || normalizedName.includes("shield");
}
