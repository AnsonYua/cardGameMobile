import type { SlotViewModel } from './SlotTypes';

export function shouldUseBoardSlotSprite(slot?: SlotViewModel) {
  if (!slot) return false;
  const hasUnit = !!slot.unit;
  const hasPilot = !!slot.pilot;
  // For exact-card target prompts (unit-only or pilot-only), use dialog card rendering.
  // Board slot sprites intentionally slice pilot art for battlefield composition.
  return hasUnit && hasPilot;
}
