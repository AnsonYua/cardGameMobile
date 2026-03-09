type SlotNotificationLike = {
  type?: string;
  payload?: any;
};

function getPromptChoiceData(note: SlotNotificationLike): any {
  const payload = note?.payload ?? {};
  const event = payload?.event ?? payload;
  return event?.data ?? {};
}

function isActiveTopDeckSelectionReviewPrompt(note: SlotNotificationLike): boolean {
  const type = (note?.type ?? "").toString().toUpperCase();
  if (type !== "PROMPT_CHOICE") return false;
  const payload = note?.payload ?? {};
  if (payload?.isCompleted === true) return false;
  const event = payload?.event ?? payload;
  if ((event?.status ?? "").toString().toUpperCase() === "RESOLVED") return false;
  const data = getPromptChoiceData(note);
  if (data?.userDecisionMade === true) return false;
  const choiceId = (data?.choiceId ?? "").toString();
  const kind = (data?.context?.kind ?? "").toString();
  return choiceId === "top_deck_selection_review_confirm" || kind === "TOP_DECK_SELECTION_REVIEW_CONFIRM";
}

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

export function findHandRevealedCard(
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
    if (type !== "HAND_CARDS_REVEALED") continue;
    const payload = note?.payload ?? {};
    if (playerId && payload?.playerId && String(payload.playerId) !== playerId) continue;
    if (effectId && payload?.effectId && String(payload.effectId) !== effectId) continue;
    const cards = Array.isArray(payload?.cards) ? payload.cards : [];
    const match = cards.find((c: any) => String(c?.carduid ?? c?.cardUid ?? "") === cardUid);
    if (match) return match;
  }
  return undefined;
}

export function hasActiveTopDeckSelectionReviewPrompt(
  notificationQueue: SlotNotificationLike[],
  opts: { playerId?: string; sourceCarduid?: string; effectId?: string } = {},
) {
  const queue = Array.isArray(notificationQueue) ? notificationQueue : [];
  const playerId = opts.playerId ? String(opts.playerId) : "";
  const sourceCarduid = opts.sourceCarduid ? String(opts.sourceCarduid) : "";
  const effectId = opts.effectId ? String(opts.effectId) : "";

  for (let i = queue.length - 1; i >= 0; i -= 1) {
    const note = queue[i];
    if (!note || !isActiveTopDeckSelectionReviewPrompt(note)) continue;
    const data = getPromptChoiceData(note);
    if (playerId && data?.playerId && String(data.playerId) !== playerId) continue;
    const contextSource = (data?.context?.topDeckSelection?.sourceCarduid ?? data?.sourceCarduid ?? "").toString();
    if (sourceCarduid && contextSource && contextSource !== sourceCarduid) continue;
    const contextEffectId = (data?.context?.topDeckSelection?.effect?.effectId ?? "").toString();
    if (effectId && contextEffectId && contextEffectId !== effectId) continue;
    return true;
  }
  return false;
}
