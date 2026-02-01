import type { BurstChoiceGroupRow } from "../ui/BurstChoiceGroupDialog";

export type BurstSourceInfo = {
  carduid?: string;
  cardId?: string;
  name?: string;
  cardType?: string;
  sourceZone?: string;
  ownerPlayerId?: string;
  attackContext?: { attackingPlayerId?: string; attackerSlot?: string };
};

export type BurstGroupEvent = {
  id: string;
  type?: string;
  status?: string;
  playerId?: string;
  data?: any;
};

export function getGroupEvents(payload: any): BurstGroupEvent[] {
  const events: BurstGroupEvent[] = Array.isArray(payload?.events) ? payload.events : [];
  return events.filter((e) => e && typeof e.id === "string" && e.id);
}

export function isGroupEventDone(groupPayload: any, event: BurstGroupEvent): boolean {
  const resolvedIds: string[] = Array.isArray(groupPayload?.resolvedEventIds) ? groupPayload.resolvedEventIds : [];
  const id = String(event?.id ?? "");
  if (resolvedIds.includes(id)) return true;
  if ((event?.status ?? "").toString().toUpperCase() === "RESOLVED") return true;
  if (event?.data?.userDecisionMade === true) return true;
  return false;
}

export function getBurstSourceInfo(event: BurstGroupEvent): BurstSourceInfo {
  const data = event?.data ?? {};
  const burstSource = data?.burstSource ?? {};
  return {
    carduid: burstSource?.carduid ?? data?.carduid,
    cardId: burstSource?.cardId ?? "",
    name: burstSource?.name ?? data?.displayName ?? "Burst",
    cardType: burstSource?.cardType,
    sourceZone: burstSource?.sourceZone,
    ownerPlayerId: burstSource?.ownerPlayerId,
    attackContext: burstSource?.attackContext,
  };
}

export function formatBurstSourceLabel(info: BurstSourceInfo): string {
  const name = info.name ?? "Burst";
  const metaSuffix = [info.cardId, info.cardType, info.sourceZone].filter(Boolean).join(" · ");
  const attack = info.attackContext ?? {};
  const attackSuffix =
    attack?.attackingPlayerId && attack?.attackerSlot ? ` (Atk ${attack.attackingPlayerId} ${attack.attackerSlot})` : "";
  return `${name}${metaSuffix ? ` — ${metaSuffix}` : ""}${attackSuffix}`;
}

export function buildGroupDialogRows(
  groupPayload: any,
  events: BurstGroupEvent[],
  onSelect: (eventId: string) => void,
): BurstChoiceGroupRow[] {
  return events.map((event) => {
    const done = isGroupEventDone(groupPayload, event);
    const label = formatBurstSourceLabel(getBurstSourceInfo(event));
    return {
      id: String(event.id),
      label,
      done,
      enabled: !done,
      onClick: async () => {
        onSelect(String(event.id));
      },
    };
  });
}

export function findGroupEvent(events: BurstGroupEvent[], eventId: string | undefined): BurstGroupEvent | undefined {
  if (!eventId) return undefined;
  const needle = String(eventId);
  return events.find((e) => String(e?.id ?? "") === needle);
}

