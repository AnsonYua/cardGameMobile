import type { SlotNotification } from "../animations/NotificationAnimationController";
import { getNotificationQueue } from "./NotificationUtils";

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

export function findLatestTokenChoiceFromQueue(
  queue: SlotNotification[],
  opts: { preferId?: string } = {},
): TokenChoiceNote | undefined {
  if (!Array.isArray(queue) || queue.length === 0) return undefined;

  const preferId = opts.preferId ? String(opts.preferId) : "";
  if (preferId) {
    const preferred = queue.find((n: any) => String(n?.id ?? "") === preferId);
    const normalized = preferred ? normalizeTokenChoiceNotification(preferred) : undefined;
    if (normalized) return normalized;
  }

  for (let i = queue.length - 1; i >= 0; i -= 1) {
    const normalized = normalizeTokenChoiceNotification(queue[i]);
    if (normalized) return normalized;
  }
  return undefined;
}

