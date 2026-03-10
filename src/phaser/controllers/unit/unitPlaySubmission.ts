import { getEnergyState } from "../../game/actionEligibility";
import { SLOT_KEYS } from "../../game/slotUtils";
import { evaluateComparisonFilter } from "../../utils/comparisonFilter";

export type UnitPlaySubmissionAnalysis = {
  submitsImmediately: boolean;
  requiresCostReplacementConfirm: boolean;
  requiresReplacementTargetSelection: boolean;
  requiresBoardReplacementSelection: boolean;
};

export function analyzeUnitPlaySubmission(input: {
  raw: any;
  playerId?: string | null;
  selectionUid?: string;
  canPromptForReplacement?: boolean;
}): UnitPlaySubmissionAnalysis {
  const { raw, playerId, selectionUid, canPromptForReplacement = true } = input;
  if (!raw || !playerId || !selectionUid) {
    return {
      submitsImmediately: true,
      requiresCostReplacementConfirm: false,
      requiresReplacementTargetSelection: false,
      requiresBoardReplacementSelection: false,
    };
  }

  const handCard = findHandCard(raw, playerId, selectionUid);
  const cardData = handCard?.cardData;
  const replacement = getDestroyLinkedReplacementOption(raw, playerId, cardData);
  const boardFull = canPromptForReplacement && isPlayerUnitBoardFull(raw, playerId);
  if (!replacement) {
    return {
      submitsImmediately: !boardFull,
      requiresCostReplacementConfirm: false,
      requiresReplacementTargetSelection: false,
      requiresBoardReplacementSelection: boardFull,
    };
  }

  const player = raw?.gameEnv?.players?.[playerId];
  const { totalEnergy, availableEnergy } = getEnergyState(player);
  const requiredLevel = Number(cardData?.effectiveLevel ?? cardData?.level ?? 0);
  const requiredCost = Number(cardData?.effectiveCost ?? cardData?.cost ?? 0);
  const baseLevel = Number.isFinite(requiredLevel) ? Math.max(0, requiredLevel) : 0;
  const baseCost = Number.isFinite(requiredCost) ? Math.max(0, requiredCost) : 0;
  const baseAffordable = totalEnergy >= baseLevel && availableEnergy >= baseCost;
  const replacementAffordable =
    totalEnergy >= replacement.replacementLevel && availableEnergy >= replacement.replacementCost;

  const requiresCostReplacementConfirm = replacementAffordable && baseAffordable;
  const requiresReplacementTargetSelection =
    replacementAffordable && !baseAffordable && replacement.eligibleTargets.length > 1;

  return {
    submitsImmediately:
      !requiresCostReplacementConfirm &&
      !requiresReplacementTargetSelection &&
      !boardFull,
    requiresCostReplacementConfirm,
    requiresReplacementTargetSelection,
    requiresBoardReplacementSelection: boardFull,
  };
}

function findHandCard(raw: any, playerId: string, carduid: string): any {
  const hand = raw?.gameEnv?.players?.[playerId]?.deck?.hand;
  if (!Array.isArray(hand)) {
    return undefined;
  }

  return hand.find((entry: any) => {
    const uid = entry?.carduid ?? entry?.uid ?? entry?.id ?? entry?.cardId;
    return uid === carduid;
  });
}

function isPlayerUnitBoardFull(raw: any, playerId: string): boolean {
  const zones = raw?.gameEnv?.players?.[playerId]?.zones ?? {};
  return SLOT_KEYS.every((slotId) => !!zones?.[slotId]?.unit);
}

function getDestroyLinkedReplacementOption(raw: any, playerId: string, cardData: any): {
  replacementCost: number;
  replacementLevel: number;
  eligibleTargets: Array<{ slotId: string; unit: any; pilot: any }>;
} | null {
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

  const filters = replacementRule?.parameters?.replace?.from?.filters ?? {};
  const requiredCardType = normalizeText(filters?.cardType);
  const requiredNameIncludes = normalizeText(filters?.nameIncludes);
  const requiredLevel = filters?.level;

  const zones = raw?.gameEnv?.players?.[playerId]?.zones ?? {};
  const eligibleTargets = SLOT_KEYS
    .map((slotId) => ({ slotId, slot: zones?.[slotId] }))
    .filter(({ slot }) => {
      if (!slot?.unit?.carduid || !slot?.unit?.cardData) return false;
      if (!isLinkedUnitSlot(slot)) return false;

      const unitCardType = normalizeText(slot.unit.cardData?.cardType);
      if (requiredCardType && unitCardType !== requiredCardType) {
        return false;
      }

      const unitName = normalizeText(slot.unit.cardData?.name ?? slot.unit.id ?? "");
      if (requiredNameIncludes && !unitName.includes(requiredNameIncludes)) {
        return false;
      }

      const level = Number(slot.unit.cardData?.level ?? 0);
      return matchesLevel(level, requiredLevel);
    })
    .map(({ slotId, slot }) => ({
      slotId,
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
    replacementCost: Number.isFinite(replacementCost) ? Math.max(0, replacementCost) : 0,
    replacementLevel: Number.isFinite(replacementLevel) ? Math.max(0, replacementLevel) : 0,
    eligibleTargets,
  };
}

function isLinkedUnitSlot(slot: any): boolean {
  if (!slot?.unit) {
    return false;
  }

  if (!slot?.pilot) {
    const linkList = Array.isArray(slot.unit?.cardData?.link) ? slot.unit.cardData.link : [];
    return linkList.length > 0;
  }

  const unitLinks = Array.isArray(slot.unit?.cardData?.link) ? slot.unit.cardData.link : [];
  const pilotName = normalizeText(slot.pilot?.cardData?.name);
  if (!unitLinks.length || !pilotName) {
    return true;
  }

  return unitLinks.some((name: string) => normalizeText(name) === pilotName);
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function matchesLevel(level: number, filter: unknown): boolean {
  const safeLevel = Number.isFinite(level) ? level : 0;

  if (typeof filter === "number") {
    return safeLevel === filter;
  }

  if (typeof filter !== "string" || !filter.trim()) {
    return true;
  }

  const normalized = filter.trim();
  if (/^\d+$/.test(normalized)) {
    return safeLevel === Number(normalized);
  }
  if (/^=\d+$/.test(normalized)) {
    return safeLevel === Number(normalized.slice(1));
  }

  return evaluateComparisonFilter(safeLevel, normalized);
}
