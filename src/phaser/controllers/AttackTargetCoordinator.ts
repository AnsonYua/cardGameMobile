import { slotKey } from "./ControllerTypes";
import type { ActionControls } from "./ControllerTypes";
import type { SlotViewModel } from "../ui/SlotTypes";

type SlotAction = (slot: SlotViewModel) => Promise<void> | void;

export class AttackTargetCoordinator {
  private targets = new Set<string>();
  private onSelect?: SlotAction;
  private onCancel?: () => void;

  constructor(private actionControls?: ActionControls | null) {}

  enter(targets: SlotViewModel[], onSelect: SlotAction, onCancel?: () => void) {
    this.targets.clear();
    targets.forEach((target) => {
      this.targets.add(`${target.owner}-${target.slotId ?? ""}`);
    });
    this.onSelect = onSelect;
    this.onCancel = onCancel;
    this.updateActionBar();
  }

  isActive() {
    return this.onSelect !== undefined;
  }

  reset() {
    this.targets.clear();
    this.onSelect = undefined;
    this.onCancel = undefined;
  }

  isAllowed(slot: SlotViewModel) {
    return this.targets.has(slotKey(slot));
  }

  async handleSlot(slot: SlotViewModel) {
    if (!this.isActive() || !this.isAllowed(slot)) return false;
    await this.onSelect?.(slot);
    this.reset();
    return true;
  }

  applyActionBar() {
    if (!this.isActive()) return false;
    this.updateActionBar();
    return true;
  }

  private updateActionBar() {
    this.actionControls?.setState?.({
      descriptors: [
        {
          label: "Cancel Attack",
          enabled: true,
          onClick: () => {
            const cancel = this.onCancel;
            this.reset();
            cancel?.();
          },
        },
      ],
    });
  }
}
