import type { SlotViewModel, SlotOwner } from "../ui/SlotTypes";

export type ActionControls = {
  setState?: (state: { descriptors: any[] }) => void;
  setWaitingForOpponent?: (waiting: boolean, overrideButtons?: { label: string; onClick?: () => void; enabled?: boolean; primary?: boolean }[]) => void;
  setWaitingLabel?: (label: string) => void;
};

export type SlotControls = {
  setSelectedSlot?: (owner?: SlotOwner, slotId?: string) => void;
  getBoardSlotPositions?: () => Record<string, Record<string, { x: number; y: number }>> | undefined;
  setSlotClickEnabled?: (enabled: boolean) => void;
  setSlotVisible?: (owner: SlotOwner, slotId: string, visible: boolean) => void;
};

export const slotKey = (slot: SlotViewModel) => `${slot.owner}-${slot.slotId ?? ""}`;
