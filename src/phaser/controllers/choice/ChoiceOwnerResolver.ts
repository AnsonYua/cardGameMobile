import { getNotificationEvent, getNotificationQueue, isNotificationExpired } from "../../utils/NotificationUtils";
import type { ScenarioPlayerSelector } from "../../game/SeatSelector";

export type UnresolvedChoiceOwner = {
  eventId: string;
  notificationId?: string;
  type: string;
  ownerPlayerId: string;
};

const CHOICE_TYPES = new Set([
  "TARGET_CHOICE",
  "BLOCKER_CHOICE",
  "OPTION_CHOICE",
  "PROMPT_CHOICE",
  "TOKEN_CHOICE",
  "BURST_EFFECT_CHOICE",
]);

function normalize(value: unknown): string {
  return (value ?? "").toString().trim();
}

function resolveSeatSelector(raw: any, ownerPlayerId: string): ScenarioPlayerSelector {
  const currentPlayer = normalize(raw?.gameEnv?.currentPlayer ?? raw?.currentPlayer);
  if (currentPlayer && ownerPlayerId && currentPlayer === ownerPlayerId) {
    return "currentPlayer";
  }
  return "opponent";
}

export function findLatestUnresolvedChoiceOwner(raw: any): UnresolvedChoiceOwner | undefined {
  const notifications = getNotificationQueue(raw);
  for (let i = notifications.length - 1; i >= 0; i -= 1) {
    const note = notifications[i];
    if (!note) continue;
    if (isNotificationExpired(note)) continue;

    const payload: any = note?.payload ?? {};
    const event = getNotificationEvent(note);
    const type = normalize(event?.type ?? note?.type).toUpperCase();
    if (!CHOICE_TYPES.has(type)) continue;

    const isCompleted = payload?.isCompleted === true;
    if (isCompleted) continue;

    const status = normalize(event?.status).toUpperCase();
    if (status === "RESOLVED") continue;

    const userDecisionMade = event?.data?.userDecisionMade ?? payload?.userDecisionMade;
    if (userDecisionMade === true) continue;

    const eventId = normalize(event?.id ?? note?.id);
    const ownerPlayerId = normalize(event?.playerId ?? payload?.playerId);
    if (!eventId || !ownerPlayerId) continue;

    return {
      eventId,
      notificationId: normalize(note?.id) || undefined,
      type,
      ownerPlayerId,
    };
  }

  return undefined;
}

export function resolveAutoFollowChoiceOwner(params: {
  raw: any;
  selfPlayerId: string | undefined;
  attemptedChoiceIds: ReadonlySet<string>;
}): (UnresolvedChoiceOwner & { selector: ScenarioPlayerSelector }) | undefined {
  const unresolved = findLatestUnresolvedChoiceOwner(params.raw);
  if (!unresolved) return undefined;
  if (!params.selfPlayerId) return undefined;
  if (unresolved.ownerPlayerId === params.selfPlayerId) return undefined;
  if (params.attemptedChoiceIds.has(unresolved.eventId)) return undefined;

  return {
    ...unresolved,
    selector: resolveSeatSelector(params.raw, unresolved.ownerPlayerId),
  };
}
