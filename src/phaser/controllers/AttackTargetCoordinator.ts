import { slotKey } from "./ControllerTypes";
import type { ActionControls } from "./ControllerTypes";
import type { SlotViewModel } from "../ui/SlotTypes";
import type { SlotInteractionGate } from "./SlotInteractionGate";

type SlotAction = (slot: SlotViewModel) => Promise<void> | void;
const ATTACK_TARGET_SUBMIT_LOCK = "attack-target-submit";

export class AttackTargetCoordinator {
  private targets = new Set<string>();
  private onSelect?: SlotAction;
  private onCancel?: () => void;
  private submitPending = false;

  constructor(
    private actionControls?: ActionControls | null,
    private slotGate?: SlotInteractionGate | null,
  ) {}

  enter(targets: SlotViewModel[], onSelect: SlotAction, onCancel?: () => void) {
    this.clearSubmitUi();
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
    if (!this.submitPending) {
      this.clearSubmitUi();
    }
  }

  isAllowed(slot: SlotViewModel) {
    return this.targets.has(slotKey(slot));
  }

  async handleSlot(slot: SlotViewModel) {
    if (this.submitPending || !this.isActive() || !this.isAllowed(slot)) return false;
    const onSelect = this.onSelect;
    this.targets.clear();
    this.onSelect = undefined;
    this.onCancel = undefined;
    this.submitPending = true;
    this.slotGate?.disable(ATTACK_TARGET_SUBMIT_LOCK);
    this.actionControls?.setTransientLoading?.(true);
    try {
      await onSelect?.(slot);
      return true;
    } finally {
      this.clearSubmitUi();
    }
  }

  applyActionBar() {
    if (this.submitPending) return true;
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
            if (this.submitPending) return;
            const cancel = this.onCancel;
            this.reset();
            cancel?.();
          },
        },
      ],
    });
  }

  private clearSubmitUi() {
    const wasPending = this.submitPending;
    this.submitPending = false;
    if (!wasPending) return;
    this.slotGate?.enable(ATTACK_TARGET_SUBMIT_LOCK);
    this.actionControls?.setTransientLoading?.(false);
  }
}
