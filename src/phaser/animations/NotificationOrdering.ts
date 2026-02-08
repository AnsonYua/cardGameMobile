import type { SlotNotification } from "./NotificationAnimationController";

function getType(note: SlotNotification | undefined): string {
  return (note?.type ?? "").toString().toUpperCase();
}

function getCardPlayRefIdFromTargetChoice(note: SlotNotification | undefined): string | undefined {
  if (!note) return undefined;
  if (getType(note) !== "TARGET_CHOICE") return undefined;

  const payload: any = note.payload ?? {};
  const event: any = payload?.event ?? payload ?? {};
  const refId = event?.data?.cardPlayNotificationId;
  return refId ? String(refId) : undefined;
}

// Keeps backend order by default, only applying minimal dependency ordering needed for UX.
export function orderNotificationsForAnimation(notificationQueue: SlotNotification[]): SlotNotification[] {
  const queue = Array.isArray(notificationQueue) ? notificationQueue.slice() : [];
  if (queue.length <= 1) return queue;

  // Ensure the card-play animation (when referenced) runs before the target-choice prompt.
  // Backend payloads may include a `cardPlayNotificationId` but not guarantee array ordering.
  const idToIndex = new Map<string, number>();
  const rebuildIndex = () => {
    idToIndex.clear();
    queue.forEach((note, idx) => {
      if (note?.id) idToIndex.set(String(note.id), idx);
    });
  };

  rebuildIndex();
  for (let i = 0; i < queue.length; i += 1) {
    const refId = getCardPlayRefIdFromTargetChoice(queue[i]);
    if (!refId) continue;
    const refIndex = idToIndex.get(refId);
    if (refIndex === undefined) continue;
    if (refIndex < i) continue;

    const [moved] = queue.splice(refIndex, 1);
    queue.splice(i, 0, moved);
    rebuildIndex();
  }

  return queue;
}

