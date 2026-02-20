import type { SlotNotification } from "../animations/NotificationAnimationController";

export function getNotificationQueue(raw: any): SlotNotification[] {
  const queue = raw?.notificationQueue ?? raw?.gameEnv?.notificationQueue;
  if (!Array.isArray(queue)) return [];
  return queue;
}

export function getNotificationEvent(note: SlotNotification | undefined): any {
  const payload: any = note?.payload ?? {};
  return payload?.event ?? payload ?? {};
}

export function isNotificationExpired(note: SlotNotification | undefined, nowMs = Date.now()): boolean {
  const expiresAt = Number((note as any)?.metadata?.expiresAt ?? NaN);
  if (!Number.isFinite(expiresAt)) return false;
  return nowMs > expiresAt;
}

function getNotificationType(note: SlotNotification | undefined): string {
  const event: any = getNotificationEvent(note);
  return (event?.type ?? note?.type ?? "").toString().toUpperCase();
}

function getBurstChoiceKey(note: SlotNotification | undefined): string | undefined {
  if (!note) return undefined;
  const payload: any = note.payload ?? {};
  const event: any = payload?.event ?? payload ?? {};
  const key = event?.id ?? payload?.eventId ?? payload?.choiceId ?? note.id;
  return key ? String(key) : undefined;
}

function getBurstResolvedKey(note: SlotNotification | undefined): string | undefined {
  if (!note) return undefined;
  const payload: any = note.payload ?? {};
  const event: any = payload?.event ?? {};
  const key = payload?.eventId ?? payload?.choiceId ?? event?.id ?? payload?.id ?? note.id;
  return key ? String(key) : undefined;
}

function buildResolvedBurstKeys(notifications: SlotNotification[]): Set<string> {
  const resolved = new Set<string>();
  if (!Array.isArray(notifications) || notifications.length === 0) return resolved;
  for (const note of notifications) {
    const type = getNotificationType(note);
    if (type !== "BURST_EFFECT_CHOICE_RESOLVED") continue;
    const key = getBurstResolvedKey(note);
    if (key) resolved.add(key);
  }
  return resolved;
}

function findBurstChoiceByKey(notifications: SlotNotification[], key: string): SlotNotification | undefined {
  if (!Array.isArray(notifications) || notifications.length === 0) return undefined;
  if (!key) return undefined;
  for (const note of notifications) {
    const type = getNotificationType(note);
    if (type !== "BURST_EFFECT_CHOICE") continue;
    if (getBurstChoiceKey(note) === key) return note;
  }
  return undefined;
}

export function findActiveBurstChoiceNotification(
  notifications: SlotNotification[],
  opts: { preferChoiceKey?: string } = {},
): SlotNotification | undefined {
  if (!Array.isArray(notifications) || notifications.length === 0) return undefined;
  const resolved = buildResolvedBurstKeys(notifications);

  const preferredKey = opts.preferChoiceKey ? String(opts.preferChoiceKey) : "";
  if (preferredKey && !resolved.has(preferredKey)) {
    const preferred = findBurstChoiceByKey(notifications, preferredKey);
    if (preferred) {
      const payload: any = preferred.payload ?? {};
      const eventPayload: any = payload?.event ?? payload ?? {};
      const decisionMade = eventPayload?.data?.userDecisionMade === true;
      if (!decisionMade) {
        return preferred;
      }
    }
  }

  for (let i = notifications.length - 1; i >= 0; i -= 1) {
    const note = notifications[i];
    const payload: any = note?.payload ?? {};
    const type = getNotificationType(note);
    if (type !== "BURST_EFFECT_CHOICE") continue;
    const key = getBurstChoiceKey(note);
    if (!key || resolved.has(key)) continue;
    const eventPayload: any = payload?.event ?? payload ?? {};
    const decisionMade = eventPayload?.data?.userDecisionMade === true;
    if (decisionMade) continue;
    return note;
  }
  return undefined;
}

export function findActiveBurstChoiceGroupNotification(
  notifications: SlotNotification[],
  opts: { playerId?: string; includeCompleted?: boolean } = {},
): SlotNotification | undefined {
  if (!Array.isArray(notifications) || notifications.length === 0) return undefined;
  const matchPlayerId = opts.playerId ? String(opts.playerId) : "";
  const includeCompleted = opts.includeCompleted === true;
  for (let i = notifications.length - 1; i >= 0; i -= 1) {
    const note = notifications[i];
    const payload: any = note?.payload ?? {};
    const type = (note?.type ?? "").toString().toUpperCase();
    if (type !== "BURST_EFFECT_CHOICE_GROUP") continue;
    const groupPlayerId = payload?.playerId;
    if (matchPlayerId && groupPlayerId && String(groupPlayerId) !== matchPlayerId) continue;
    const isCompleted = payload?.isCompleted === true;
    if (isCompleted && !includeCompleted) continue;
    return note;
  }
  return undefined;
}

function findAttackNotification(
  notifications: SlotNotification[],
  opts: { includeBattleEnd?: boolean } = {},
): SlotNotification | undefined {
  if (!Array.isArray(notifications) || notifications.length === 0) {
    return undefined;
  }
  for (let i = notifications.length - 1; i >= 0; i -= 1) {
    const note = notifications[i];
    if (!note) continue;
    if ((note.type || "").toUpperCase() !== "UNIT_ATTACK_DECLARED") continue;
    if (!opts.includeBattleEnd && note.payload?.battleEnd === true) {
      continue;
    }
    return note;
  }
  return undefined;
}

function getBattleResolvedAttackIds(notifications: SlotNotification[]): Set<string> {
  const resolved = new Set<string>();
  if (!Array.isArray(notifications) || notifications.length === 0) return resolved;
  for (const note of notifications) {
    if (!note) continue;
    if ((note.type || "").toUpperCase() !== "BATTLE_RESOLVED") continue;
    const attackId =
      note.payload?.attackNotificationId ??
      note.payload?.sourceNotificationId ??
      note.payload?.notificationId ??
      "";
    if (!attackId) continue;
    resolved.add(String(attackId));
  }
  return resolved;
}

function getLinkedAttackNotificationId(note: SlotNotification | undefined): string | undefined {
  if (!note) return undefined;
  const type = (note.type || "").toUpperCase();
  if (type === "UNIT_ATTACK_DECLARED") {
    return note.id ? String(note.id) : undefined;
  }
  if (type !== "REFRESH_TARGET") {
    return undefined;
  }
  const id =
    note.payload?.sourceNotificationId ??
    note.payload?.attackNotificationId ??
    note.payload?.notificationId ??
    "";
  if (!id) return undefined;
  return String(id);
}

function buildAttackNotificationIndex(notifications: SlotNotification[]): Map<string, SlotNotification> {
  const byId = new Map<string, SlotNotification>();
  for (const note of notifications) {
    if (!note?.id) continue;
    if ((note.type || "").toUpperCase() !== "UNIT_ATTACK_DECLARED") continue;
    byId.set(String(note.id), note);
  }
  return byId;
}

export function hasBattleResolvedAttackNotification(
  notifications: SlotNotification[],
  attackNotificationId?: string,
): boolean {
  if (!attackNotificationId) return false;
  const resolved = getBattleResolvedAttackIds(notifications);
  return resolved.has(String(attackNotificationId));
}

export function findLiveAttackNotification(notifications: SlotNotification[]): SlotNotification | undefined {
  return findLiveAttackIndicatorNotification(notifications);
}

export function findLiveAttackIndicatorNotification(notifications: SlotNotification[]): SlotNotification | undefined {
  if (!Array.isArray(notifications) || notifications.length === 0) return undefined;
  const resolvedAttackIds = getBattleResolvedAttackIds(notifications);
  const attackById = buildAttackNotificationIndex(notifications);
  let hasAnonymousBattleResolved = false;
  for (let i = notifications.length - 1; i >= 0; i -= 1) {
    const note = notifications[i];
    if (!note) continue;
    const type = (note.type || "").toUpperCase();
    if (type === "BATTLE_RESOLVED") {
      const attackId =
        note.payload?.attackNotificationId ??
        note.payload?.sourceNotificationId ??
        note.payload?.notificationId ??
        "";
      if (!attackId) {
        hasAnonymousBattleResolved = true;
      }
      continue;
    }
    if (hasAnonymousBattleResolved) return undefined;
    if (type === "REFRESH_TARGET") {
      const attackId = getLinkedAttackNotificationId(note);
      if (attackId && resolvedAttackIds.has(attackId)) continue;
      const sourceAttack = attackId ? attackById.get(attackId) : undefined;
      if (sourceAttack?.payload?.battleEnd === true) continue;
      const payload = note.payload ?? {};
      const hasRedirectTarget = Boolean(
        payload.forcedTargetCarduid ||
          payload.forcedTargetZone ||
          payload.forcedTargetPlayerId ||
          payload.targetCarduid ||
          payload.targetSlotName ||
          payload.targetSlot,
      );
      if (!hasRedirectTarget) continue;
      return note;
    }
    if (type !== "UNIT_ATTACK_DECLARED") continue;
    const attackId = getLinkedAttackNotificationId(note);
    if (note.payload?.battleEnd === true) continue;
    if (attackId && resolvedAttackIds.has(attackId)) continue;
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
  return findAttackNotification(notifications, opts);
}

export function getActiveAttackTargetSlotKey(
  note: SlotNotification | undefined,
  resolveSlotOwnerByPlayer: (playerId?: string) => "player" | "opponent" | undefined,
) {
  if (!note) return undefined;
  const type = (note.type || "").toUpperCase();
  if (type !== "UNIT_ATTACK_DECLARED" && type !== "REFRESH_TARGET") return undefined;
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
