import type { SlotViewModel } from "../ui/SlotTypes";

export const getSlotKey = (slot: Pick<SlotViewModel, "owner" | "slotId">) => `${slot.owner}-${slot.slotId}`;

export const mapSlotsByKey = (slots: SlotViewModel[]) => {
  const byKey = new Map<string, SlotViewModel>();
  slots.forEach((slot) => byKey.set(getSlotKey(slot), slot));
  return byKey;
};

export const getSlotPrimaryUid = (slot?: SlotViewModel | null) => slot?.unit?.cardUid ?? slot?.pilot?.cardUid ?? undefined;

export const canApplySnapshotToKey = (opts: {
  liveSlot?: SlotViewModel;
  snapshotSlot?: SlotViewModel;
}) => {
  const liveUid = getSlotPrimaryUid(opts.liveSlot);
  const snapshotUid = getSlotPrimaryUid(opts.snapshotSlot);
  if (liveUid && snapshotUid && liveUid !== snapshotUid) return false;
  if (liveUid && !snapshotUid) return false;
  return true;
};

export const canApplyEventUidToKey = (opts: { liveSlot?: SlotViewModel; eventUid: string }) => {
  const liveUid = getSlotPrimaryUid(opts.liveSlot);
  if (liveUid && liveUid !== opts.eventUid) return false;
  return true;
};

