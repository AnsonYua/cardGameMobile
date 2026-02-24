import type { SlotCardView, SlotViewModel } from "../ui/SlotTypes";

type AllowAttackRule = {
  action?: string;
  sourceConditions?: Array<{ type?: string } | string>;
  parameters?: {
    status?: string;
    level?: string;
    ap?: string | number;
    damaged?: boolean;
    pairedPilot?: string;
    pairedPilotTrait?: string;
    allowActiveTarget?: boolean;
  };
};

export function getAttackUnitTargets(attacker: SlotViewModel | undefined, opponentSlots: SlotViewModel[]): SlotViewModel[] {
  if (!attacker?.unit) return [];
  return opponentSlots.filter((slot) => {
    const unit = slot.unit;
    if (!unit) return false;
    if (unit.isRested) return true;
    return canTargetActiveUnit(attacker.unit, attacker.pilot, slot);
  });
}

function canTargetActiveUnit(attackerUnit?: SlotCardView, attackerPilot?: SlotCardView, targetSlot?: SlotViewModel) {
  const targetUnit = targetSlot?.unit;
  if (!targetUnit) return false;
  const rules = [...getAllowAttackRules(attackerUnit), ...getAllowAttackRules(attackerPilot)].filter((rule) =>
    canGrantActiveTargetPermission(rule) && sourceConditionsSatisfied(rule, attackerPilot),
  );
  if (!rules.length) return false;
  return rules.some((rule) => matchesAllowAttackRule(rule, targetSlot));
}

function getAllowAttackRules(card?: SlotCardView): AllowAttackRule[] {
  const staticRules: any[] = Array.isArray(card?.cardData?.effects?.rules) ? card.cardData.effects.rules : [];
  const directRules = staticRules.filter((rule) => (rule?.action || "").toString().toLowerCase() === "allow_attack_target");

  const temporaryRules = (Array.isArray(card?.temporaryEffects) ? card.temporaryEffects : [])
    .map((effect) => effect?.allowAttackTarget)
    .filter((allow) => allow && typeof allow === "object")
    .map((allow) => ({ action: "allow_attack_target", parameters: allow }));

  return [...directRules, ...temporaryRules];
}

function matchesAllowAttackRule(rule: AllowAttackRule, targetSlot?: SlotViewModel): boolean {
  const targetUnit = targetSlot?.unit;
  if (!targetUnit) return false;
  const params = rule.parameters ?? {};
  const status = (params.status ?? "").toString().toLowerCase();
  if (status && status !== "active") return false;
  if (status === "active" && targetUnit.isRested === true) return false;

  const levelExpr = (params.level ?? "").toString().trim();
  if (levelExpr) {
    const targetLevel = Number(targetUnit.cardData?.level);
    if (!Number.isFinite(targetLevel)) return false;
    const parsed = parseLevelExpression(levelExpr);
    if (!parsed) return false;
    if (!compareLevel(targetLevel, parsed.op, parsed.value)) return false;
  }

  if (typeof params.ap === "number") {
    const targetAp = Number(targetUnit.cardData?.ap);
    if (!Number.isFinite(targetAp) || targetAp !== params.ap) return false;
  } else if (typeof params.ap === "string") {
    const targetAp = Number(targetUnit.cardData?.ap);
    if (!Number.isFinite(targetAp)) return false;
    const parsed = parseLevelExpression(params.ap.trim());
    if (!parsed || !compareLevel(targetAp, parsed.op, parsed.value)) return false;
  }

  if (typeof params.damaged === "boolean") {
    const isDamaged = Number(targetUnit.damageReceived ?? 0) > 0;
    if (isDamaged !== params.damaged) return false;
  }

  if (typeof params.pairedPilot === "string") {
    const pairedPilot = params.pairedPilot.toLowerCase();
    const hasPairedPilot = Boolean(targetSlot?.pilot);
    if (pairedPilot === "any" && !hasPairedPilot) return false;
    if (pairedPilot === "none" && hasPairedPilot) return false;
    if (pairedPilot !== "any" && pairedPilot !== "none") return false;
  }

  if (typeof params.pairedPilotTrait === "string") {
    const pilotTraits = Array.isArray(targetSlot?.pilot?.cardData?.traits) ? targetSlot.pilot.cardData.traits : [];
    if (!pilotTraits.includes(params.pairedPilotTrait)) return false;
  }

  return true;
}

function canGrantActiveTargetPermission(rule: AllowAttackRule): boolean {
  const params = rule.parameters ?? {};
  if (params.allowActiveTarget === true) return true;
  if ((params.status ?? "").toString().toLowerCase() === "active") return true;
  if (typeof params.level === "string") return true;
  if (typeof params.ap === "string" || typeof params.ap === "number") return true;
  if (typeof params.damaged === "boolean") return true;
  return false;
}

function sourceConditionsSatisfied(rule: AllowAttackRule, attackerPilot?: SlotCardView): boolean {
  const sourceConditions = Array.isArray(rule.sourceConditions) ? rule.sourceConditions : [];
  if (!sourceConditions.length) return true;
  return sourceConditions.every((condition) => {
    const type = typeof condition === "string" ? condition.toLowerCase() : (condition?.type || "").toLowerCase();
    if (type === "paired" || type === "ispaired") {
      return Boolean(attackerPilot);
    }
    return true;
  });
}

function parseLevelExpression(expr: string): { op: string; value: number } | null {
  const match = expr.match(/^(<=|>=|==|=|<|>)\s*(\d+)$/);
  if (!match) return null;
  const value = Number(match[2]);
  if (!Number.isFinite(value)) return null;
  const op = match[1] === "=" ? "==" : match[1];
  return { op, value };
}

function compareLevel(target: number, op: string, value: number) {
  switch (op) {
    case "<":
      return target < value;
    case "<=":
      return target <= value;
    case ">":
      return target > value;
    case ">=":
      return target >= value;
    case "==":
      return target === value;
    default:
      return false;
  }
}
