import type { SlotViewModel, SlotOwner } from "../ui/SlotTypes";

export type ActionControls = {
  setState?: (state: { descriptors: any[] }) => void;
  setWaitingForOpponent?: (waiting: boolean, overrideButtons?: { label: string; onClick?: () => void; enabled?: boolean; primary?: boolean }[]) => void;
};

export type SlotControls = {
  setSelectedSlot?: (owner?: SlotOwner, slotId?: string) => void;
  getSlotPositions?: () => Record<string, Record<string, { x: number; y: number }>> | undefined;
  setSlotClickEnabled?: (enabled: boolean) => void;
};

export const slotKey = (slot: SlotViewModel) => `${slot.owner}-${slot.slotId ?? ""}`;
