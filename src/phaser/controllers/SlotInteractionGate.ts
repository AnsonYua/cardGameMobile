import type { SlotControls } from "./ControllerTypes";

export class SlotInteractionGate {
  private disabledReasons = new Set<string>();

  constructor(private slotControls?: SlotControls | null) {}

  disable(reason: string) {
    if (!reason) return;
    this.disabledReasons.add(reason);
    this.apply();
  }

  enable(reason: string) {
    if (!reason) return;
    if (this.disabledReasons.delete(reason)) {
      this.apply();
    }
  }

  reset() {
    if (this.disabledReasons.size === 0) return;
    this.disabledReasons.clear();
    this.apply();
  }

  private apply() {
    const enabled = this.disabledReasons.size === 0;
    this.slotControls?.setSlotClickEnabled?.(enabled);
  }
}
