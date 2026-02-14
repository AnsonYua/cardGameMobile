type PlayerZoneSummary = {
  shield: number;
  active: number;
  rested: number;
  extra: number;
};

type PlayerMap = Record<string, any>;

export function resolvePlayerIds(players: PlayerMap, selfId?: string | null) {
  const playerIds = Object.keys(players);
  if (!playerIds.length) {
    return { selfId: undefined, opponentId: undefined };
  }
  const resolvedSelf =
    (selfId && players[selfId] ? selfId : undefined) ?? playerIds[0];
  const opponentId = playerIds.find((id) => id !== resolvedSelf) ?? playerIds[0];
  return { selfId: resolvedSelf, opponentId };
}

export function getOpponentHandCount(players: PlayerMap, selfId?: string | null) {
  const { opponentId } = resolvePlayerIds(players, selfId);
  const opponent = opponentId ? players?.[opponentId] : undefined;
  const handCount = opponent?.deck?.handCount;
  if (typeof handCount === "number" && Number.isFinite(handCount)) return handCount;
  const hand = opponent?.deck?.hand;
  const handUids = opponent?.deck?.handUids;
  if (typeof hand?.length === "number") return hand.length;
  if (Array.isArray(hand)) return hand.length;
  if (hand && typeof hand === "object") return Object.keys(hand).length;
  if (Array.isArray(handUids)) return handUids.length;
  return "-";
}

export function getEnergyStatus(players: PlayerMap, selfId?: string | null) {
  const { selfId: resolvedSelf, opponentId } = resolvePlayerIds(players, selfId);
  if (!resolvedSelf || !opponentId) {
    return { selfStatus: undefined, oppStatus: undefined };
  }
  const summarize = (player: any): PlayerZoneSummary => {
    const zones = player?.zones || player?.zone || {};
    const shieldArea = zones.shieldArea || player?.shieldArea || [];
    const energyArea = zones.energyArea || player?.energyArea || [];
    const shieldCount = zones.shieldCount ?? player?.shieldCount;
    const shield =
      typeof shieldCount === "number" && Number.isFinite(shieldCount)
        ? shieldCount
        : Array.isArray(shieldArea)
          ? shieldArea.length
          : 0;
    const energies = Array.isArray(energyArea) ? energyArea : [];
    const active = energies.filter((e) => e && e.isRested === false && e.isExtraEnergy === false).length;
    const rested = energies.filter((e) => e && e.isRested === true && e.isExtraEnergy === false).length;
    const extra = energies.filter((e) => e && e.isRested === false && e.isExtraEnergy === true).length;
    return { shield, active, rested, extra };
  };

  return {
    selfStatus: summarize(players[resolvedSelf]),
    oppStatus: summarize(players[opponentId]),
  };
}
