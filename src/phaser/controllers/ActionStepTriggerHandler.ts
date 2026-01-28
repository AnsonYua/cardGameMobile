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
      return;
    }
    if (selection.kind === "hand") {
      const cardType = (this.deps.getSelectedHandCard()?.cardType || "").toLowerCase();
      if (cardType === "command") {
        await this.deps.runActionThenRefresh("playCommandFromHand", "hand");
        return;
      }
      return;
    }
    if (selection.kind === "slot") {
      this.deps.cancelSelection();
      return;
    }
    if (selection.kind === "base") {
      this.deps.cancelSelection();
    }
  }

  async handlePilotEffectTrigger(slot?: SlotViewModel) {
    void slot;
    this.deps.cancelSelection();
  }

  async handleUnitEffectTrigger(slot?: SlotViewModel) {
    void slot;
    this.deps.cancelSelection();
  }
}
