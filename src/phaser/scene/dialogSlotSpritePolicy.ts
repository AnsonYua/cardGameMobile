import type Phaser from "phaser";
import type { SlotViewModel } from "../ui/SlotTypes";

export type CreateSlotSprite = (
  slot: SlotViewModel,
  size: { w: number; h: number },
) => Phaser.GameObjects.Container | undefined;

export function createBoardSlotOnlySprite(createSlotSprite?: CreateSlotSprite): CreateSlotSprite {
  return (slot, size) => {
    const slotId = (slot?.slotId ?? "").toString().toLowerCase();
    const isBoardSlot = /^slot[1-6]$/.test(slotId);
    if (!isBoardSlot) return undefined;
    return createSlotSprite?.(slot, size);
  };
}

