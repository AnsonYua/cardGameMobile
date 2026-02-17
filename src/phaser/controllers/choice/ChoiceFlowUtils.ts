import { getNotificationEvent, getNotificationQueue, isNotificationExpired } from "../../utils/NotificationUtils";

export type NormalizedChoiceEntry = {
  id?: string;
  type?: string;
  status?: string;
  playerId?: string;
  data?: any;
  rawNotification?: any;
};

export function buildChoiceEntryFromNotification(note: any): NormalizedChoiceEntry | undefined {
  if (!note) return undefined;
  const event = note?.payload?.event ?? note?.payload ?? {};
  return {
    id: event?.id ?? note?.id,
    type: event?.type ?? note?.type,
    status: event?.status,
    playerId: event?.playerId ?? note?.payload?.playerId,
    data: event?.data ?? note?.payload?.data,
    rawNotification: note,
  };
}

export function findActiveChoiceEntryFromRaw(raw: any, type: string): any | undefined {
  const targetType = (type ?? "").toString().toUpperCase();
  if (!targetType) return undefined;

  const processingQueue = raw?.gameEnv?.processingQueue ?? raw?.processingQueue;
  if (Array.isArray(processingQueue) && processingQueue.length) {
    for (let i = processingQueue.length - 1; i >= 0; i -= 1) {
      const entry: any = processingQueue[i];
      if (!entry) continue;
      const entryType = (entry?.type ?? "").toString().toUpperCase();
      if (entryType !== targetType) continue;
      const status = (entry?.status ?? "").toString().toUpperCase();
      if (status && status === "RESOLVED") continue;
      const decision = entry?.data?.userDecisionMade;
      if (decision !== false) continue;
      return entry;
    }
  }

  const notifications = getNotificationQueue(raw);
  for (let i = notifications.length - 1; i >= 0; i -= 1) {
    const note: any = notifications[i];
    if (!note) continue;
    if (isNotificationExpired(note)) continue;
    const noteType = (note?.type ?? "").toString().toUpperCase();
    if (noteType !== targetType) continue;
    const event = getNotificationEvent(note);
    const eventType = (event?.type ?? noteType).toString().toUpperCase();
    if (eventType !== targetType) continue;
    const status = (event?.status ?? "").toString().toUpperCase();
    if (status && status === "RESOLVED") continue;
    const decision = event?.data?.userDecisionMade;
    if (decision !== false) continue;
    return event;
  }

  return undefined;
}
