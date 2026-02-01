import { getNotificationQueue } from "../utils/NotificationUtils";

export type GameEndInfo = {
  winnerId?: string;
  loserId?: string;
  endReason?: string;
  endedAt?: number | string;
  notificationId?: string;
};

export function detectGameEnd(raw: any): GameEndInfo | null {
  if (!raw) return null;
  const gameEnv = raw?.gameEnv ?? raw;
  if (gameEnv?.gameEnded) {
    return {
      winnerId: gameEnv?.winnerId,
      loserId: gameEnv?.loserId,
      endReason: gameEnv?.endReason,
      endedAt: gameEnv?.endedAt,
    };
  }
  const notifications = getNotificationQueue(raw);
  const endedNote = notifications.find((note) => (note?.type || "").toString().toUpperCase() === "GAME_ENDED");
  if (endedNote) {
    const payload = endedNote.payload ?? {};
    return {
      winnerId: payload.winnerId,
      loserId: payload.loserId,
      endReason: payload.reason,
      endedAt: payload.endedAt ?? payload.timestamp,
      notificationId: endedNote.id,
    };
  }
  const battleEnd = notifications.find(
    (note) => (note?.type || "").toString().toUpperCase() === "BATTLE_RESOLVED" && note?.payload?.result?.gameEnded,
  );
  if (battleEnd) {
    const result = battleEnd?.payload?.result ?? {};
    return {
      winnerId: result.winnerId ?? battleEnd?.payload?.winnerId,
      loserId: result.loserId ?? battleEnd?.payload?.loserId,
      endReason: result.endReason ?? result.reason,
      endedAt: result.endedAt ?? result.timestamp,
    };
  }
  return null;
}
