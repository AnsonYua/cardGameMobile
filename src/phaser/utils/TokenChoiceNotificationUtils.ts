import type { SlotNotification } from "../animations/NotificationAnimationController";
import { getNotificationQueue, isNotificationExpired } from "./NotificationUtils";

export type TokenChoiceNote = {
  id: string;
  playerId?: string;
  isCompleted: boolean;
  decisionMade: boolean;
  effectId?: string;
  data?: any;
};

export function normalizeTokenChoiceNotification(notification: any): TokenChoiceNote | undefined {
  if (!notification) return undefined;
  const type = (notification?.type ?? "").toString().toUpperCase();
  if (type !== "TOKEN_CHOICE") return undefined;
  const payload = notification?.payload ?? {};
  const event = payload?.event ?? payload ?? {};
  const eventType = (event?.type ?? type).toString().toUpperCase();
  if (eventType !== "TOKEN_CHOICE") return undefined;
  const id = String(notification?.id ?? event?.id ?? "");
  if (!id) return undefined;
  const data = event?.data ?? {};
  const status = (event?.status ?? "").toString().toUpperCase();
  return {
    id,
    playerId: payload?.playerId ?? event?.playerId,
    isCompleted: payload?.isCompleted === true || status === "RESOLVED",
    decisionMade: data?.userDecisionMade === true,
    effectId: data?.effect?.effectId ?? data?.effectId,
    data,
  };
}

export function findLatestTokenChoiceFromRaw(raw: any, opts: { preferId?: string } = {}): TokenChoiceNote | undefined {
  const queue = getNotificationQueue(raw);
  return findLatestTokenChoiceFromQueue(queue, opts);
}

export function findActiveTokenChoiceFromRaw(raw: any, opts: { preferId?: string } = {}): TokenChoiceNote | undefined {
  const preferId = opts.preferId ? String(opts.preferId) : "";
  const queue = getNotificationQueue(raw);
  return findLatestTokenChoiceFromQueue(queue, { preferId, unresolvedOnly: true, skipExpired: true });
}

export function findLatestTokenChoiceFromQueue(
  queue: SlotNotification[],
  opts: { preferId?: string; unresolvedOnly?: boolean; skipExpired?: boolean } = {},
): TokenChoiceNote | undefined {
  if (!Array.isArray(queue) || queue.length === 0) return undefined;

  const preferId = opts.preferId ? String(opts.preferId) : "";
  const unresolvedOnly = opts.unresolvedOnly === true;
  const skipExpired = opts.skipExpired === true;
  if (preferId) {
    const preferred = queue.find((n: any) => String(n?.id ?? "") === preferId);
    const normalized = preferred ? normalizeTokenChoiceNotification(preferred) : undefined;
    if (
      normalized &&
      (!unresolvedOnly || (!normalized.isCompleted && !normalized.decisionMade)) &&
      (!skipExpired || !isNotificationExpired(preferred))
    ) {
      return normalized;
    }
  }

  for (let i = queue.length - 1; i >= 0; i -= 1) {
    const note = queue[i];
    const normalized = normalizeTokenChoiceNotification(note);
    if (!normalized) continue;
    if (unresolvedOnly && (normalized.isCompleted || normalized.decisionMade)) continue;
    if (skipExpired && isNotificationExpired(note)) continue;
    return normalized;
  }
  return undefined;
}
