import type { SlotCardView, SlotViewModel } from "../ui/SlotTypes";

type AllowAttackRule = {
  action?: string;
  parameters?: { status?: string; level?: string };
};

export function getAttackUnitTargets(attacker: SlotViewModel | undefined, opponentSlots: SlotViewModel[]): SlotViewModel[] {
  if (!attacker?.unit) return [];
  return opponentSlots.filter((slot) => {
    const unit = slot.unit;
    if (!unit) return false;
    if (unit.isRested) return true;
    return canTargetActiveUnit(attacker.unit, attacker.pilot, unit);
  });
}

function canTargetActiveUnit(attackerUnit?: SlotCardView, attackerPilot?: SlotCardView, targetUnit?: SlotCardView) {
  if (!targetUnit) return false;
  const rules = [...getAllowAttackRules(attackerUnit), ...getAllowAttackRules(attackerPilot)];
  if (!rules.length) return false;
  return rules.some((rule) => matchesAllowAttackRule(rule, targetUnit));
}

function getAllowAttackRules(card?: SlotCardView): AllowAttackRule[] {
  const rules: any[] = Array.isArray(card?.cardData?.effects?.rules) ? card.cardData.effects.rules : [];
  return rules.filter((rule) => (rule?.action || "").toString().toLowerCase() === "allow_attack_target");
}

function matchesAllowAttackRule(rule: AllowAttackRule, targetUnit: SlotCardView): boolean {
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

  return true;
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
