export function isBattleActionStep(raw?: any): boolean {
  const battle = getBattle(raw);
  if (!battle) return false;
  const status = (battle?.status || "").toString().toUpperCase();
  return status === "ACTION_STEP";
}

export function getBattle(raw?: any): any {
  return raw?.gameEnv?.currentBattle ?? raw?.gameEnv?.currentbattle ?? null;
}

export function isBattleStateConsistent(raw?: any): boolean {
  const battle = getBattle(raw);
  if (!battle) return true;
  const attackerUid =
    battle?.attackerCarduid ??
    battle?.attackerUnitUid ??
    battle?.attacker?.carduid ??
    battle?.attacker?.cardUid ??
    "";
  if (!attackerUid) return true;
  return isCardOnBoardSlots(raw, attackerUid);
}

function isCardOnBoardSlots(raw: any, cardUid: string): boolean {
  if (!raw || !cardUid) return false;
  const players = raw?.gameEnv?.players;
  if (!players || typeof players !== "object") return false;
  const slotIds = ["slot1", "slot2", "slot3", "slot4", "slot5", "slot6"];
  for (const player of Object.values(players) as any[]) {
    const zones = player?.zones;
    if (!zones) continue;
    for (const slotId of slotIds) {
      const slot = zones[slotId];
      const unitUid = slot?.unit?.carduid ?? slot?.unit?.cardUid;
      const pilotUid = slot?.pilot?.carduid ?? slot?.pilot?.cardUid;
      if (unitUid === cardUid || pilotUid === cardUid) return true;
    }
  }
  return false;
}
