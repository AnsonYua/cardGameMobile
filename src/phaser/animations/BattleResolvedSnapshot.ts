import type { SlotOwner, SlotViewModel } from "../ui/SlotTypes";
import type { SlotNotification } from "./NotificationAnimationController";
import { toPreviewKey } from "../ui/HandTypes";

export type ResolveSlotOwnerByPlayer = (playerId?: string) => SlotOwner | undefined;

type SlotCardPayload = {
  cardId?: string;
  id?: string;
  uid?: string;
  carduid?: string;
  cardUid?: string;
  isRested?: boolean;
  cardData?: any;
};

type BattleSeedPayload = {
  playerId?: string;
  slot?: string;
  unit?: SlotCardPayload;
  pilot?: SlotCardPayload;
  fieldCardValue?: Record<string, any>;
};

function toCardId(payload?: SlotCardPayload) {
  return payload?.cardId ?? payload?.cardData?.id ?? payload?.id;
}

function toCardUid(payload?: SlotCardPayload) {
  return payload?.carduid ?? payload?.cardUid ?? payload?.uid ?? payload?.id;
}

function toSlotCard(payload?: SlotCardPayload) {
  if (!payload) return undefined;
  const id = toCardId(payload);
  if (!id) return undefined;
  return {
    id,
    textureKey: toPreviewKey(id),
    cardUid: toCardUid(payload),
    cardType: payload?.cardData?.cardType,
    isRested: payload?.isRested,
    cardData: payload?.cardData,
  };
}

function buildSlotFromBattlePayload(
  source: BattleSeedPayload | undefined,
  owner: SlotOwner | undefined,
  slotId: string | undefined,
): SlotViewModel | undefined {
  if (!source || !owner || !slotId) return undefined;
  const unit = toSlotCard(source.unit);
  const pilot = toSlotCard(source.pilot);
  if (!unit && !pilot) return undefined;
  const fieldCardValue = source.fieldCardValue ?? {};
  return {
    owner,
    slotId,
    unit,
    pilot,
    isRested: source.unit?.isRested ?? source.pilot?.isRested ?? false,
    ap: fieldCardValue.totalAP ?? 0,
    hp: fieldCardValue.totalHP ?? 0,
    fieldCardValue,
  };
}

export function buildBattleResolvedSnapshotSlots(
  note: SlotNotification,
  resolveSlotOwnerByPlayer: ResolveSlotOwnerByPlayer,
): SlotViewModel[] {
  const type = (note?.type ?? "").toString().toUpperCase();
  if (type !== "BATTLE_RESOLVED") return [];
  const payload = note?.payload ?? {};

  const attackerOwner = resolveSlotOwnerByPlayer(payload?.attacker?.playerId ?? payload?.attackingPlayerId);
  const targetOwner =
    resolveSlotOwnerByPlayer(payload?.target?.playerId ?? payload?.defendingPlayerId) ||
    (attackerOwner === "player" ? "opponent" : attackerOwner === "opponent" ? "player" : undefined);

  const attackerSlotId = payload?.attacker?.slot ?? payload?.attackerSlot ?? payload?.attackerSlotName ?? undefined;
  const targetSlotId =
    payload?.target?.slot ?? payload?.targetSlot ?? payload?.targetSlotName ?? payload?.forcedTargetZone ?? undefined;

  const attackerSlot = buildSlotFromBattlePayload(payload?.attacker as BattleSeedPayload, attackerOwner, attackerSlotId);
  const targetSlot = buildSlotFromBattlePayload(payload?.target as BattleSeedPayload, targetOwner, targetSlotId);

  return [attackerSlot, targetSlot].filter(Boolean) as SlotViewModel[];
}

