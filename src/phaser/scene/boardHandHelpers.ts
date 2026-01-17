import { getNotificationQueue } from "../utils/NotificationUtils";
import type { AnimationQueue } from "../animations/AnimationQueue";

export function shouldDeferHandUpdate(
  raw: any,
  skipAnimation: boolean,
  animationQueue: AnimationQueue | undefined,
  playerId: string | undefined,
) {
  if (skipAnimation) return false;
  if (!animationQueue) return false;
  if (!playerId) return false;
  const notifications = getNotificationQueue(raw);
  if (!notifications.length) return false;
  return notifications.some((note) => {
    if (!note?.id) return false;
    const type = (note.type || "").toUpperCase();
    if (type === "INIT_HAND") {
      return note.payload?.playerId === playerId && !animationQueue.isProcessed(note.id);
    }
    if (type !== "CARD_DRAWN" && type !== "CARD_ADDED_TO_HAND") return false;
    if (note.payload?.playerId !== playerId) return false;
    return !animationQueue.isProcessed(note.id);
  });
}

export function shouldHideHandForStartGame(
  raw: any,
  startGameAnimating: boolean,
  startGameCompleted: boolean,
  playerId: string | undefined,
) {
  if (startGameAnimating) return true;
  const notifications = getNotificationQueue(raw);
  if (!notifications.length) return false;
  if (!playerId) return false;
  return notifications.some((note) => {
    if (!note?.id) return false;
    const type = (note.type || "").toUpperCase();
    if (type !== "INIT_HAND") return false;
    if (note.payload?.playerId !== playerId) return false;
    return !startGameCompleted;
  });
}

export function shouldRefreshHandForEvent(event: { type?: string; payload?: any }, playerId: string | undefined) {
  if (!event) return false;
  const type = (event.type || "").toUpperCase();
  if (type !== "CARD_DRAWN" && type !== "CARD_ADDED_TO_HAND") return false;
  const eventPlayerId = event.payload?.playerId;
  return !!eventPlayerId && eventPlayerId === playerId;
}
