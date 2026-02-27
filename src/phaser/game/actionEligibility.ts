import type { SelectionTarget } from "./SelectionStore";
import { getTurnOwnerId } from "./turnOwner";
import { filterActivatedEffectRulesByAvailability } from "./activatedEffectAvailability";
import { normalizePhaseToken } from "./phaseUtils";
import { SLOT_KEYS } from "./slotUtils";
import { evaluateComparisonFilter } from "../utils/comparisonFilter";

export function getEnergyState(player: any) {
  const energyArea = player?.zones?.energyArea ?? player?.energyArea ?? [];
  const totalEnergy = Array.isArray(energyArea) ? energyArea.length : 0;
  const availableEnergy = Array.isArray(energyArea)
    ? energyArea.filter((entry: any) => entry && entry.isRested === false).length
    : 0;
  return { totalEnergy, availableEnergy };
}

function getHandCardByUid(raw: any, playerId: string | null | undefined, uid: string) {
  const player = raw?.gameEnv?.players?.[playerId || ""];
  const hand = player?.deck?.hand ?? [];
  if (!Array.isArray(hand)) return undefined;
  return hand.find((card: any) => {
    const cardUid = card?.carduid ?? card?.uid ?? card?.id ?? card?.cardId;
    return cardUid === uid;
  });
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function slotIsLinked(slot: any): boolean {
  const unit = slot?.unit;
  if (!unit) return false;

  const pilot = slot?.pilot;
  if (!pilot) {
    // For GD01-002 replacement eligibility, link-capable units count even if currently unpaired.
    return Array.isArray(unit?.cardData?.link) && unit.cardData.link.length > 0;
  }

  // Frontend snapshots may omit link metadata; treat unit+pilot pair as linked for UI gating.
  const unitLinks: string[] = Array.isArray(unit?.cardData?.link) ? unit.cardData.link : [];
  const pilotName = normalizeText(pilot?.cardData?.name);
  if (!unitLinks.length || !pilotName) return true;

  return unitLinks.some((name) => normalizeText(name) === pilotName);
}

function matchesNumericFilter(value: number, filter: unknown): boolean {
  if (typeof filter === "number") {
    return value === filter;
  }

  if (typeof filter !== "string" || filter.trim().length === 0) {
    return true;
  }

  const normalized = filter.trim();
  if (/^\d+$/.test(normalized)) {
    return value === Number(normalized);
  }
  if (/^=\d+$/.test(normalized)) {
    return value === Number(normalized.slice(1));
  }

  return evaluateComparisonFilter(value, normalized);
}

function getDestroyLinkedReplacementOption(raw: any, playerId: string | null | undefined, cardData: any) {
  if (!raw?.gameEnv?.players || !playerId) {
    return null;
  }

  const rules = Array.isArray(cardData?.effects?.rules) ? cardData.effects.rules : [];
  const replacementRule = rules.find((rule: any) => {
    if (!rule || typeof rule !== "object") return false;
    if ((rule?.type || "").toString().toLowerCase() !== "play") return false;
    if ((rule?.trigger || "").toString().toLowerCase() !== "cost") return false;
    if ((rule?.action || "").toString().toLowerCase() !== "replace_cost") return false;

    const from = rule?.parameters?.replace?.from;
    return from?.type === "destroy" && from?.target === "friendly_linked_unit";
  });

  if (!replacementRule) {
    return null;
  }

  const from = replacementRule?.parameters?.replace?.from ?? {};
  const filters = from?.filters ?? {};
  const requiredCardType = normalizeText(filters?.cardType);
  const requiredNameIncludes = normalizeText(filters?.nameIncludes);
  const requiredLevel = filters?.level;

  const player = raw?.gameEnv?.players?.[playerId];
  const zones = player?.zones ?? {};
  const eligibleTargets = SLOT_KEYS
    .map((slotId) => ({ slotId, slot: zones?.[slotId] }))
    .filter(({ slot }) => {
      const unit = slot?.unit;
      if (!unit?.carduid || !unit?.cardData) return false;
      if (!slotIsLinked(slot)) return false;

      const cardType = normalizeText(unit.cardData?.cardType);
      if (requiredCardType && cardType !== requiredCardType) return false;

      const unitName = normalizeText(unit.cardData?.name || unit?.name || "");
      if (requiredNameIncludes && !unitName.includes(requiredNameIncludes)) return false;

      const level = Number(unit.cardData?.level ?? 0);
      if (!matchesNumericFilter(Number.isFinite(level) ? level : 0, requiredLevel)) return false;

      return true;
    })
    .map(({ slotId, slot }) => ({
      slotId,
      carduid: slot?.unit?.carduid,
      unit: slot?.unit,
      pilot: slot?.pilot,
    }));

  if (!eligibleTargets.length) {
    return null;
  }

  const to = replacementRule?.parameters?.replace?.to ?? {};
  const replacementCost = Number(to?.cost ?? 0);
  const replacementLevel = Number(to?.level ?? 0);

  return {
    ruleId: replacementRule?.effectId,
    replacementCost: Number.isFinite(replacementCost) ? Math.max(0, replacementCost) : 0,
    replacementLevel: Number.isFinite(replacementLevel) ? Math.max(0, replacementLevel) : 0,
    eligibleTargets,
  };
}

export function canPlaySelectedHandCard(selection: SelectionTarget, raw: any, playerId?: string | null) {
  if (selection.kind !== "hand") return false;
  const player = raw?.gameEnv?.players?.[playerId || ""];
  if (!player) return true;

  const target = getHandCardByUid(raw, playerId, selection.uid);
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

  const baseAffordable = totalEnergy >= level && availableEnergy >= cost;
  if (baseAffordable) {
    return true;
  }

  const replacement = getDestroyLinkedReplacementOption(raw, playerId, cardData);
  if (!replacement) {
    return false;
  }

  return totalEnergy >= replacement.replacementLevel && availableEnergy >= replacement.replacementCost;
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
  const currentPhase = normalizePhaseToken(phase);
  if (!currentPhase) return false;
  return rules.some((rule) => {
    const windows: any[] = Array.isArray(rule?.timing?.windows) ? rule.timing.windows : [];
    return windows.some((window) => normalizePhaseToken(window) === currentPhase);
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
  const currentPhase = normalizePhaseToken(phase);
  if (!currentPhase) return [];
  return rules.filter((rule) => {
    if ((rule?.type || "").toString().toLowerCase() !== "activated") return false;
    const windows = Array.isArray(rule?.timing?.windows) ? rule.timing.windows : [];
    return windows.some((window: string) => normalizePhaseToken(window) === currentPhase);
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
