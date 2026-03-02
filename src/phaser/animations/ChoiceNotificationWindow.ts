import type { SlotNotification } from "./NotificationAnimationController";

const BLOCKING_CHOICE_TYPES = new Set(["TARGET_CHOICE", "BLOCKER_CHOICE", "BURST_EFFECT_CHOICE"]);

function getType(note: SlotNotification | undefined): string {
  return (note?.type ?? "").toString().toUpperCase();
}

function getChoiceEvent(note: SlotNotification | undefined): any {
  return note?.payload?.event ?? note?.payload ?? {};
}

function isBlockingChoiceNotification(note: SlotNotification | undefined, selfPlayerId?: string | null): boolean {
  const type = getType(note);
  if (!BLOCKING_CHOICE_TYPES.has(type)) return false;

  const event = getChoiceEvent(note);
  const eventType = (event?.type ?? type).toString().toUpperCase();
  if (!BLOCKING_CHOICE_TYPES.has(eventType)) return false;

  const status = (event?.status ?? "").toString().toUpperCase();
  if (status && status !== "DECLARED") return false;

  if (event?.data?.userDecisionMade !== false) return false;
  if (note?.payload?.isCompleted === true) return false;

  const ownerId = (event?.playerId ?? note?.payload?.playerId ?? event?.data?.playerId ?? "").toString();
  if (selfPlayerId && ownerId && ownerId !== selfPlayerId) return false;

  return true;
}

export function findFirstBlockingChoiceIndex(
  events: SlotNotification[],
  selfPlayerId?: string | null,
): number {
  if (!Array.isArray(events) || events.length === 0) return -1;

  for (let i = 0; i < events.length; i += 1) {
    if (isBlockingChoiceNotification(events[i], selfPlayerId)) {
      return i;
    }
  }

  return -1;
}

export function sliceEventsForBlockingChoice(
  events: SlotNotification[],
  selfPlayerId?: string | null,
): SlotNotification[] {
  if (!Array.isArray(events) || events.length === 0) return [];

  const blockingIndex = findFirstBlockingChoiceIndex(events, selfPlayerId);
  if (blockingIndex < 0) return events;
  return events.slice(0, blockingIndex + 1);
}
