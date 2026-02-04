export function isBattleActionStep(raw?: any): boolean {
  const battle = raw?.gameEnv?.currentBattle ?? raw?.gameEnv?.currentbattle;
  if (!battle) return false;
  const status = (battle?.status || "").toString().toUpperCase();
  return status === "ACTION_STEP";
}

