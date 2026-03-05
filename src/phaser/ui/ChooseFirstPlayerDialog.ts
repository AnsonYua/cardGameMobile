import Phaser from "phaser";
import { DEFAULT_CARD_DIALOG_CONFIG } from "./CardDialogLayout";
import { getDialogTimerHeaderGap } from "./timerBarStyles";
import { BinaryTimedChoiceDialog } from "./dialog/BinaryTimedChoiceDialog";
import type { TurnTimerController } from "../controllers/TurnTimerController";

type ChooseFirstPlayerDialogOpts = {
  onFirst?: () => Promise<void> | void;
  onSecond?: () => Promise<void> | void;
  firstLabel?: string;
  secondLabel?: string;
};

/**
 * Turn order dialog styled like the mulligan prompt.
 */
export class ChooseFirstPlayerDialog {
  private prompt: BinaryTimedChoiceDialog;

  constructor(scene: Phaser.Scene, timerController?: TurnTimerController) {
    const cfg = {
      ...DEFAULT_CARD_DIALOG_CONFIG,
      z: { ...DEFAULT_CARD_DIALOG_CONFIG.z, dialog: 3000 },
    };
    this.prompt = new BinaryTimedChoiceDialog(scene, timerController, cfg);
  }

  async showPrompt(opts: ChooseFirstPlayerDialogOpts): Promise<boolean> {
    const headerText = "Choose Turn Order";
    const firstLabel = opts.firstLabel || "Go First";
    const secondLabel = opts.secondLabel || "Go Second";
    return this.prompt.showPrompt({
      headerText,
      promptText: "",
      leftLabel: firstLabel,
      rightLabel: secondLabel,
      onLeft: opts.onFirst,
      onRight: opts.onSecond,
      timeoutChoice: "left",
      showOverlay: false,
      closeOnBackdrop: false,
      showCloseButton: false,
      headerGap: getDialogTimerHeaderGap(),
    });
  }

  getAutomationState() {
    return this.prompt.getAutomationState();
  }

  async choose(decision: "first" | "second"): Promise<boolean> {
    const state = this.prompt.getAutomationState();
    if (!state) return false;
    if (decision === "first") return this.prompt.choose(0);
    return this.prompt.choose(1);
  }
}
