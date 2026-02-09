import type { SelectionTarget } from "./SelectionStore";
import { getTurnOwnerId } from "./turnOwner";
import { filterActivatedEffectRulesByAvailability } from "./activatedEffectAvailability";
import { SLOT_KEYS } from "./slotUtils";

export function getEnergyState(player: any) {
  const energyArea = player?.zones?.energyArea ?? player?.energyArea ?? [];
  const totalEnergy = Array.isArray(energyArea) ? energyArea.length : 0;
  const availableEnergy = Array.isArray(energyArea)
    ? energyArea.filter((entry: any) => entry && entry.isRested === false).length
    : 0;
  return { totalEnergy, availableEnergy };
}

export function canPlaySelectedHandCard(selection: SelectionTarget, raw: any, playerId?: string | null) {
  if (selection.kind !== "hand") return false;
  const player = raw?.gameEnv?.players?.[playerId || ""];
  if (!player) return true;
  const hand = player?.deck?.hand ?? [];
  const target = Array.isArray(hand)
    ? hand.find((card: any) => {
        const uid = card?.carduid ?? card?.uid ?? card?.id ?? card?.cardId;
        return uid === selection.uid;
      })
    : undefined;
  if (!target) return true;
  const cardData = target?.cardData ?? {};
  const cardType = (cardData.cardType || selection.cardType || "").toLowerCase();
  const isEnergy = cardType === "energy";
  if (isEnergy) return true;

  const { totalEnergy, availableEnergy } = getEnergyState(player);
  const requiredLevel = Number(cardData.effectiveLevel ?? cardData.level ?? 0);
  const requiredCost = Number(cardData.effectiveCost ?? cardData.cost ?? 0);
  const level = Number.isNaN(requiredLevel) ? 0 : requiredLevel;
  const cost = Number.isNaN(requiredCost) ? 0 : requiredCost;
  if (totalEnergy < level) return false;
  if (availableEnergy < cost) return false;
  return true;
}

export function getSlotCardType(selection: SelectionTarget, raw: any, playerId?: string | null) {
  if (selection.kind !== "slot") return undefined;
  const players = raw?.gameEnv?.players ?? {};
  const ids = Object.keys(players);
  if (!ids.length) return undefined;
  const ownerId = resolveSlotOwnerId(selection, ids, playerId);
  if (!ownerId) return undefined;
  const slot = players?.[ownerId]?.zones?.[selection.slotId];
  return slot?.unit?.cardData?.cardType ?? slot?.pilot?.cardData?.cardType;
}

export function getSlotCard(selection: SelectionTarget, raw: any, playerId?: string | null) {
  if (selection.kind !== "slot") return undefined;
  const players = raw?.gameEnv?.players ?? {};
  const ids = Object.keys(players);
  if (!ids.length) return undefined;
  const ownerId = resolveSlotOwnerId(selection, ids, playerId);
  if (!ownerId) return undefined;
  const slot = players?.[ownerId]?.zones?.[selection.slotId];
  return slot?.unit ?? slot?.pilot;
}

export function commandHasTimingWindow(
  selection: SelectionTarget,
  raw: any,
  playerId?: string | null,
  phase?: string | null,
) {
  if (selection.kind !== "hand") return false;
  if (!raw || !playerId) return false;
  const hand = raw?.gameEnv?.players?.[playerId]?.deck?.hand ?? [];
  const target = Array.isArray(hand)
    ? hand.find((card: any) => {
        const uid = card?.carduid ?? card?.uid ?? card?.id ?? card?.cardId;
        return uid === selection.uid;
      })
    : undefined;
  const cardData = target?.cardData ?? {};
  const rules: any[] = Array.isArray(cardData?.effects?.rules) ? cardData.effects.rules : [];
  if (!rules.length) return false;
  const currentPhase = (phase ?? "").toString().toUpperCase();
  if (!currentPhase) return false;
  return rules.some((rule) => {
    const windows: any[] = Array.isArray(rule?.timing?.windows) ? rule.timing.windows : [];
    return windows.some((window) => (window ?? "").toString().toUpperCase() === currentPhase);
  });
}

export function hasPairableUnit(raw: any, playerId?: string | null) {
  if (!raw || !playerId) return true;
  const player = raw?.gameEnv?.players?.[playerId];
  const zones = player?.zones ?? {};
  return SLOT_KEYS.some((slotId) => {
    const slot = zones?.[slotId];
    if (!slot) return false;
    return !!slot.unit && !slot.pilot;
  });
}

export function getActivatedEffectRule(cardData?: any, phase?: string | null) {
  return getActivatedEffectRules(cardData, phase)[0];
}

export function getActivatedEffectRules(cardData?: any, phase?: string | null) {
  const rules: any[] = Array.isArray(cardData?.effects?.rules) ? cardData.effects.rules : [];
  const currentPhase = (phase ?? "").toString().toUpperCase();
  if (!currentPhase) return [];
  return rules.filter((rule) => {
    if ((rule?.type || "").toString().toLowerCase() !== "activated") return false;
    const windows = Array.isArray(rule?.timing?.windows) ? rule.timing.windows : [];
    return windows.some((window: string) => window.toString().toUpperCase() === currentPhase);
  });
}

export type ActivatedEffectOption = {
  effectId: string;
  enabled: boolean;
  availableEnergy: number;
  requiredEnergy: number;
  oncePerTurn: boolean;
  alreadyUsed: boolean;
};

export function getActivatedEffectOptions(card: any, raw: any, playerId: string): ActivatedEffectOption[] {
  if (!card || !raw || !playerId) return [];
  const phase = raw?.gameEnv?.phase ?? raw?.phase ?? "";
  const timingRules = getActivatedEffectRules(card?.cardData, phase).filter((rule) => !!rule?.effectId);
  const rules = filterActivatedEffectRulesByAvailability({ card, raw, playerId, rules: timingRules });
  if (!rules.length) return [];
  const player = raw?.gameEnv?.players?.[playerId];
  const { availableEnergy } = getEnergyState(player);
  const currentTurn = raw?.gameEnv?.currentTurn;
  const isSelfTurn = getTurnOwnerId(raw) === playerId;

  return rules.map((effectRule) => {
    const required = Number(effectRule?.cost?.resource ?? 0);
    const requiredEnergy = Number.isFinite(required) ? required : 0;
    const lastUsed = card?.effectUsage?.[effectRule.effectId]?.lastUsedTurn;
    const oncePerTurn = effectRule?.cost?.oncePerTurn === true;
    const alreadyUsed = oncePerTurn && currentTurn !== undefined && lastUsed === currentTurn;
    const restCost = (effectRule?.cost?.rest ?? "").toString().toLowerCase();
    const restOk = restCost !== "self" || card?.isRested !== true;
    return {
      effectId: effectRule.effectId,
      availableEnergy,
      requiredEnergy,
      oncePerTurn,
      alreadyUsed,
      enabled: isSelfTurn && availableEnergy >= requiredEnergy && restOk && !alreadyUsed,
    };
  });
}

export function getActivatedEffectState(card: any, raw: any, playerId: string) {
  const opt = getActivatedEffectOptions(card, raw, playerId)[0];
  if (!opt?.effectId) return undefined;
  return { effectId: opt.effectId, enabled: opt.enabled };
}

export function getSlotCards(selection: SelectionTarget, raw: any, playerId?: string | null) {
  if (selection.kind !== "slot") return undefined;
  const players = raw?.gameEnv?.players ?? {};
  const ids = Object.keys(players);
  if (!ids.length) return undefined;
  const ownerId = resolveSlotOwnerId(selection, ids, playerId);
  if (!ownerId) return undefined;
  const slot = players?.[ownerId]?.zones?.[selection.slotId];
  if (!slot) return undefined;
  return { ownerId, unit: slot?.unit, pilot: slot?.pilot };
}

function resolveSlotOwnerId(selection: SelectionTarget, ids: string[], playerId?: string | null) {
  return selection.owner === "player"
    ? playerId
    : selection.owner === "opponent"
    ? ids.find((id) => id !== playerId)
    : undefined;
}
