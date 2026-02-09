import type { SlotViewModel } from "../../ui/SlotTypes";

export type ApiTargetRef = {
  carduid: string;
  zone: string;
  playerId: string;
};

function uidOf(target: any): string {
  return (target?.carduid || target?.cardUid || "").toString();
}

export function mapSlotToApiTargetRef(opts: {
  slot: SlotViewModel;
  availableTargets: any[];
  selfPlayerId: string;
  otherPlayerId: string;
}): ApiTargetRef {
  const targetUid = opts.slot?.unit?.cardUid || opts.slot?.pilot?.cardUid;
  const zone = opts.slot?.slotId || "";
  const ownerPlayerId = opts.slot?.owner === "player" ? opts.selfPlayerId : opts.otherPlayerId;

  // If we have a concrete card uid (ex: selecting multiple cards from the trash), ONLY match by uid.
  // Falling back to zone+player would always pick the first card in that zone and collapse multi-selections.
  const matched = targetUid
    ? opts.availableTargets.find((t) => uidOf(t) && uidOf(t) === targetUid)
    : opts.availableTargets.find((t) => t?.zone && t?.playerId && t.zone === zone && t.playerId === ownerPlayerId);

  return {
    carduid: (uidOf(matched) || targetUid || "").toString(),
    zone: (matched?.zone || zone || "").toString(),
    playerId: (matched?.playerId || ownerPlayerId || "").toString(),
  };
}

