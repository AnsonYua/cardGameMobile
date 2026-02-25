import { getActivatedEffectOptions, type ActivatedEffectOption } from "../game/actionEligibility";
import type { SlotViewModel } from "../ui/SlotTypes";
import { cardUidMatchesActionTarget, getActionTargetEffectIds, type ActionTargetEntry, zoneMatchesSlot } from "./ActionStepUtils";

type SlotCardKind = "unit" | "pilot";

export type ActionStepCardEffectResolution = {
  carduid?: string;
  allowedEffectIds: string[];
  options: ActivatedEffectOption[];
  matchedTarget?: ActionTargetEntry;
};

export type ActionStepSlotEffectResolution = {
  unit: ActionStepCardEffectResolution;
  pilot: ActionStepCardEffectResolution;
};

function normalizeCardType(value: unknown): string {
  return (value ?? "").toString().trim().toLowerCase();
}

function findTargetForSlotCard(slot: SlotViewModel, cardKind: SlotCardKind, targets: ActionTargetEntry[]): ActionTargetEntry | undefined {
  const cardUid = slot?.[cardKind]?.cardUid;
  if (!targets.length) return undefined;

  const exact = targets.find((target) => cardUidMatchesActionTarget(cardUid, target));
  if (exact) return exact;

  return targets.find((target) => {
    if (!zoneMatchesSlot(slot.slotId, target)) return false;
    const targetCardType = normalizeCardType(target.cardType);
    return !targetCardType || targetCardType === cardKind;
  });
}

export function getActionStepActivatedEffectOptionsForSlotCard(params: {
  slot?: SlotViewModel;
  cardKind: SlotCardKind;
  raw: any;
  playerId?: string;
  targets?: ActionTargetEntry[];
}): ActionStepCardEffectResolution {
  const { slot, cardKind, raw, playerId, targets = [] } = params;
  if (!slot || slot.owner !== "player" || !playerId) {
    return { allowedEffectIds: [], options: [] };
  }

  const rawSlot = raw?.gameEnv?.players?.[playerId]?.zones?.[slot.slotId];
  const rawCard = rawSlot?.[cardKind];
  const carduid = (rawCard?.carduid ?? slot?.[cardKind]?.cardUid ?? "").toString() || undefined;
  if (!rawCard || !carduid) {
    return { carduid, allowedEffectIds: [], options: [] };
  }

  const matchedTarget = findTargetForSlotCard(slot, cardKind, targets);
  const allowedEffectIds = getActionTargetEffectIds(matchedTarget);
  const options = getActivatedEffectOptions(rawCard, raw, playerId);
  const filteredOptions =
    allowedEffectIds.length > 0 ? options.filter((opt) => allowedEffectIds.includes(opt.effectId)) : options;

  return {
    carduid,
    allowedEffectIds,
    options: filteredOptions,
    matchedTarget,
  };
}

export function getActionStepActivatedEffectOptionsForSlot(params: {
  slot?: SlotViewModel;
  raw: any;
  playerId?: string;
  targets?: ActionTargetEntry[];
}): ActionStepSlotEffectResolution {
  return {
    unit: getActionStepActivatedEffectOptionsForSlotCard({ ...params, cardKind: "unit" }),
    pilot: getActionStepActivatedEffectOptionsForSlotCard({ ...params, cardKind: "pilot" }),
  };
}

export function slotHasActionStepActivatedEffects(params: {
  slot?: SlotViewModel;
  raw: any;
  playerId?: string;
  targets?: ActionTargetEntry[];
}): boolean {
  const resolved = getActionStepActivatedEffectOptionsForSlot(params);
  return resolved.unit.options.length > 0 || resolved.pilot.options.length > 0;
}
