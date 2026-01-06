import type { HandCardView } from "../ui/HandTypes";
import type { SlotViewModel } from "../ui/SlotTypes";

export class ActionStepTriggerHandler {
  constructor(
    private deps: {
      getSelectedHandCard: () => HandCardView | undefined;
      runActionThenRefresh: (actionId: string, source: "hand" | "slot" | "base" | "neutral") => Promise<void>;
      cancelSelection: () => void;
    },
  ) {}

  async handleActionStepTrigger(selection: any) {
    if (!selection) {
      console.warn("No selection to activate");
      return;
    }
    if (selection.kind === "hand") {
      const cardType = (this.deps.getSelectedHandCard()?.cardType || "").toLowerCase();
      console.log("[handleActionStepTrigger] hand cardType", cardType);
      if (cardType === "command") {
        await this.deps.runActionThenRefresh("playCommandFromHand", "hand");
        return;
      }
      console.warn("Hand card activation unsupported for type", cardType);
      return;
    }
    if (selection.kind === "slot") {
      console.log("Activate effect from slot (placeholder)");
      this.deps.cancelSelection();
      return;
    }
    if (selection.kind === "base") {
      console.log("Activate effect from base (placeholder)");
      this.deps.cancelSelection();
    }
  }

  async handlePilotEffectTrigger(slot?: SlotViewModel) {
    console.log("Trigger pilot effect placeholder", slot?.slotId);
    this.deps.cancelSelection();
  }

  async handleUnitEffectTrigger(slot?: SlotViewModel) {
    console.log("Trigger unit effect placeholder", slot?.slotId);
    this.deps.cancelSelection();
  }
}
