import type { AnimationContext } from "../AnimationTypes";
import type { SlotNotification } from "../NotificationAnimationController";

type TargetNoticeTemplate = {
  headerText: string;
  effectText: string;
};

type TargetRef = {
  carduid?: string;
  cardUid?: string;
  zone?: string;
  playerId?: string;
};

export type TargetGrantNotice = {
  headerText: string;
  message: string;
  slotKeys: string[];
};

const TARGET_NOTICE_TEMPLATES: Record<string, TargetNoticeTemplate> = {
  PREVENT_SET_ACTIVE_NEXT_TURN_GRANTED: {
    headerText: "Target Lock Applied",
    effectText: "This unit cannot be set active during your next Start Phase.",
  },
};

export function resolveTargetGrantNotice(event: SlotNotification, ctx: AnimationContext): TargetGrantNotice | undefined {
  const type = (event?.type ?? "").toString().toUpperCase();
  const template = TARGET_NOTICE_TEMPLATES[type];
  if (!template) return undefined;
  if (!ctx.currentPlayerId) return undefined;

  const payload = event?.payload ?? {};
  const rawTargets = Array.isArray(payload?.targets) ? payload.targets : [];
  if (rawTargets.length === 0) return undefined;

  const localTargets = rawTargets
    .map((entry) => normalizeTarget(entry))
    .filter((entry): entry is Required<Pick<TargetRef, "playerId" | "zone">> & TargetRef => !!entry?.playerId && !!entry?.zone)
    .filter((entry) => entry.playerId === ctx.currentPlayerId);
  if (localTargets.length === 0) return undefined;

  const lineItems: string[] = [];
  const slotKeys: string[] = [];

  localTargets.forEach((target, idx) => {
    const zone = normalizeZone(target.zone);
    const owner = ctx.resolveSlotOwnerByPlayer(target.playerId);
    const isSlotZone = /^slot[1-6]$/.test(zone);
    const slotKey = owner && isSlotZone ? `${owner}-${zone}` : undefined;
    if (slotKey && !slotKeys.includes(slotKey)) {
      slotKeys.push(slotKey);
    }

    const zoneLabel = formatZoneLabel(zone);
    const cardName = resolveCardName(ctx, target.playerId, zone, target.carduid ?? target.cardUid);
    lineItems.push(`${idx + 1}. ${zoneLabel}${cardName ? ` (${cardName})` : ""}`);
  });

  const message = `${template.effectText}\n\nTargeted slot(s):\n${lineItems.join("\n")}`;
  return {
    headerText: template.headerText,
    message,
    slotKeys,
  };
}

function normalizeTarget(value: any): TargetRef | undefined {
  if (!value || typeof value !== "object") return undefined;
  return {
    carduid: value.carduid,
    cardUid: value.cardUid,
    zone: value.zone,
    playerId: value.playerId,
  };
}

function normalizeZone(value: unknown): string {
  return (value ?? "").toString().toLowerCase();
}

function formatZoneLabel(zone: string): string {
  const slotMatch = /^slot([1-6])$/.exec(zone);
  if (slotMatch) {
    return `Slot ${slotMatch[1]}`;
  }
  return zone || "unknown zone";
}

function resolveCardName(ctx: AnimationContext, playerId: string, zone: string, targetCarduid?: string): string | undefined {
  const slot = ctx.currentRaw?.gameEnv?.players?.[playerId]?.zones?.[zone];
  if (!slot) return undefined;
  const unit = slot.unit;
  const pilot = slot.pilot;
  const targetUid = (targetCarduid ?? "").toString();
  const pickUnit = !targetUid || targetUid === unit?.carduid || targetUid === unit?.cardUid;
  if (pickUnit && unit?.cardData?.name) return unit.cardData.name;
  if (targetUid && (targetUid === pilot?.carduid || targetUid === pilot?.cardUid) && pilot?.cardData?.name) {
    return pilot.cardData.name;
  }
  return unit?.cardData?.name ?? pilot?.cardData?.name;
}
