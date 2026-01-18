export const START_GAME_PHASES = new Set(["REDRAW_PHASE", "START_GAME", "STARTGAME"]);

export function getPhase(raw: any) {
  return (raw?.gameEnv?.phase || "").toString().toUpperCase();
}

export function isStartGamePhase(phase: string) {
  return START_GAME_PHASES.has(phase);
}

export function isPlayersTurn(raw: any, playerId: string) {
  return raw?.gameEnv?.currentPlayer === playerId;
}

export function isMainPhase(raw: any, playerId: string) {
  return raw?.gameEnv?.phase === "MAIN_PHASE" && raw?.gameEnv?.currentPlayer === playerId;
}

export function buildSlotActionDescriptors(opponentHasUnit: boolean, attackerReady: boolean, allowAttackShield: boolean) {
  const descriptors: Array<{ id: string; label: string; enabled: boolean; primary?: boolean }> = [];
  if (opponentHasUnit) {
    descriptors.push({
      id: "attackUnit",
      label: "Attack Unit",
      enabled: attackerReady,
      primary: true,
    });
  }
  if (allowAttackShield) {
    descriptors.push({
      id: "attackShieldArea",
      label: "Attack Shield",
      enabled: attackerReady,
      primary: !descriptors.some((d) => d.primary),
    });
  }
  descriptors.push({
    id: "cancelSelection",
    label: "Cancel",
    enabled: true,
  });
  return descriptors;
}
