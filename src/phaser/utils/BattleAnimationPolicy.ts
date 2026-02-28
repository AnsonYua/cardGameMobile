export function getBattleType(payload: any): string {
  return (payload?.battleType ?? "").toString().toLowerCase();
}

export function isAttackUnitBattle(payload: any): boolean {
  return getBattleType(payload) === "attackunit";
}

export function shouldSuppressMissingTargetPlaceholder(payload: any): boolean {
  if (!isAttackUnitBattle(payload)) return false;
  const result = payload?.result ?? {};
  return result.aborted === true || result.targetMissing === true;
}

export function shouldSkipBattleResolutionAnimation(payload: any): boolean {
  if (!isAttackUnitBattle(payload)) return false;
  const result = payload?.result ?? {};
  if (result.aborted !== true) return false;
  return (
    result.damageStepExecuted === false ||
    result.preBattle === true ||
    result.battleDamageApplied === false
  );
}
