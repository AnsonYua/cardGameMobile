type SlotNotificationLike = {
  type?: string;
  payload?: any;
};

export function findTopDeckViewedCard(
  notificationQueue: SlotNotificationLike[],
  opts: { playerId?: string; effectId?: string; cardUid: string },
) {
  const queue = Array.isArray(notificationQueue) ? notificationQueue : [];
  const cardUid = String(opts.cardUid ?? "");
  if (!cardUid) return undefined;
  const playerId = opts.playerId ? String(opts.playerId) : "";
  const effectId = opts.effectId ? String(opts.effectId) : "";

  for (let i = queue.length - 1; i >= 0; i -= 1) {
    const note: any = queue[i];
    if (!note) continue;
    const type = (note?.type ?? "").toString().toUpperCase();
    if (type !== "TOP_DECK_VIEWED") continue;
    const payload = note?.payload ?? {};
    if (playerId && payload?.playerId && String(payload.playerId) !== playerId) continue;
    if (effectId && payload?.effectId && String(payload.effectId) !== effectId) continue;
    const cards = Array.isArray(payload?.cards) ? payload.cards : [];
    const match = cards.find((c: any) => String(c?.carduid ?? c?.cardUid ?? "") === cardUid);
    if (match) return match;
  }
  return undefined;
}

