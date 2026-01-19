import { getNotificationQueue } from "../utils/NotificationUtils";

export type GameEndInfo = {
  winnerId?: string;
  endReason?: string;
  endedAt?: number | string;
};

export function detectGameEnd(raw: any): GameEndInfo | null {
  if (!raw) return null;
  const gameEnv = raw?.gameEnv ?? raw;
  if (gameEnv?.gameEnded) {
    return {
      winnerId: gameEnv?.winnerId,
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
      endReason: payload.reason,
      endedAt: payload.timestamp,
    };
  }
  const battleEnd = notifications.find(
    (note) => (note?.type || "").toString().toUpperCase() === "BATTLE_RESOLVED" && note?.payload?.result?.gameEnded,
  );
  if (battleEnd) {
    const result = battleEnd?.payload?.result ?? {};
    return {
      winnerId: result.winnerId ?? battleEnd?.payload?.winnerId,
      endReason: result.endReason ?? result.reason,
      endedAt: result.endedAt ?? result.timestamp,
    };
  }
  return null;
}
