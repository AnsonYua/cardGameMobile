import type { SlotNotification } from "../animations/NotificationAnimationController";
import {
  findActiveBurstChoiceGroupNotification,
  findActiveBurstChoiceNotification,
  getNotificationQueue,
} from "../utils/NotificationUtils";

export function getTurnOwnerId(raw: any): string | undefined {
  const explicit = raw?.gameEnv?.turnOwnerId;
  if (typeof explicit === "string" && explicit) return explicit;
  const derived = raw?.gameEnv?.clientTurnOwnerId;
  if (typeof derived === "string" && derived) return derived;
  const fallback = raw?.gameEnv?.currentPlayer ?? raw?.currentPlayer;
  return typeof fallback === "string" && fallback ? fallback : undefined;
}

export function setClientTurnOwnerId(raw: any, playerId: string | undefined) {
  if (!raw?.gameEnv || typeof raw.gameEnv !== "object") return;
  if (typeof playerId !== "string" || !playerId) return;
  raw.gameEnv.clientTurnOwnerId = playerId;
}

export function getCurrentTurn(raw: any): number | undefined {
  const value = raw?.gameEnv?.currentTurn;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

export function hasActiveBurstPrompt(raw: any): boolean {
  const queue: SlotNotification[] = getNotificationQueue(raw);
  return (
    !!findActiveBurstChoiceGroupNotification(queue, { includeCompleted: false }) ||
    !!findActiveBurstChoiceNotification(queue)
  );
}
