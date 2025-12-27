import type { SlotNotification } from "../animations/NotificationAnimationController";

export function getNotificationQueue(raw: any): SlotNotification[] {
  const queue = raw?.notificationQueue ?? raw?.gameEnv?.notificationQueue;
  if (!Array.isArray(queue)) return [];
  return queue;
}

function findAttackNotification(
  notifications: SlotNotification[],
  opts: { includeBattleEnd?: boolean; logBattleEndSkip?: boolean } = {},
): SlotNotification | undefined {
  if (!Array.isArray(notifications) || notifications.length === 0) {
    return undefined;
  }
  for (let i = notifications.length - 1; i >= 0; i -= 1) {
    const note = notifications[i];
    if (!note) continue;
    if ((note.type || "").toUpperCase() !== "UNIT_ATTACK_DECLARED") continue;
    if (!opts.includeBattleEnd && note.payload?.battleEnd === true) {
      if (opts.logBattleEndSkip) {
        // eslint-disable-next-line no-console
        console.log("[NotificationUtils] skip attack note with battleEnd", note.id);
      }
      continue;
    }
    return note;
  }
  return undefined;
}

export function findLatestAttackNotification(
  notifications: SlotNotification[],
  opts: { includeBattleEnd?: boolean } = {},
): SlotNotification | undefined {
  return findAttackNotification(notifications, opts);
}

export function findActiveAttackNotification(
  notifications: SlotNotification[],
  opts: { includeBattleEnd?: boolean } = {},
): SlotNotification | undefined {
  return findAttackNotification(notifications, { ...opts, logBattleEndSkip: true });
}

export function getActiveAttackTargetSlotKey(
  note: SlotNotification | undefined,
  resolveSlotOwnerByPlayer: (playerId?: string) => "player" | "opponent" | undefined,
) {
  if (!note) return undefined;
  if ((note.type || "").toUpperCase() !== "UNIT_ATTACK_DECLARED") return undefined;
  const payload = note.payload || {};
  const slotId =
    payload.forcedTargetZone ||
    payload.targetSlotName ||
    payload.targetSlot ||
    payload.slotId ||
    payload.targetSlotId;
  if (!slotId) return undefined;
  const targetPlayerId = payload.forcedTargetPlayerId || payload.targetPlayerId || payload.defendingPlayerId;
  const owner = resolveSlotOwnerByPlayer(targetPlayerId);
  if (!owner) return undefined;
  return `${owner}-${slotId}`;
}

export function getUpcomingBattleSlotKeys(
  notifications: SlotNotification[],
  resolveSlotOwnerByPlayer: (playerId?: string) => "player" | "opponent" | undefined,
) {
  const slots = new Set<string>();
  if (!Array.isArray(notifications) || notifications.length === 0) {
    return slots;
  }
  for (const note of notifications) {
    if (!note) continue;
    if ((note.type || "").toUpperCase() !== "BATTLE_RESOLVED") continue;
    const payload = note.payload || {};
    const attackerSlotId = payload.attacker?.slot;
    const targetSlotId = payload.target?.slot;
    const attackerPlayerId = payload.attacker?.playerId;
    const targetPlayerId = payload.target?.playerId;
    const attackerOwner = resolveSlotOwnerByPlayer(attackerPlayerId);
    const targetOwner = resolveSlotOwnerByPlayer(targetPlayerId);
    if (attackerOwner && attackerSlotId) {
      slots.add(`${attackerOwner}-${attackerSlotId}`);
    }
    if (targetOwner && targetSlotId) {
      slots.add(`${targetOwner}-${targetSlotId}`);
    }
  }
  return slots;
}
