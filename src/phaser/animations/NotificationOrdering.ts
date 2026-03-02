import type { SlotNotification } from "./NotificationAnimationController";

// Backend notificationQueue order is authoritative. The frontend only filters
// already-processed/unsupported events; it does not reorder unprocessed events.
export function orderNotificationsForAnimation(notificationQueue: SlotNotification[]): SlotNotification[] {
  return Array.isArray(notificationQueue) ? notificationQueue.slice() : [];
}
