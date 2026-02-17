import Phaser from "phaser";
import { DEFAULT_CARD_DIALOG_CONFIG } from "./CardDialogLayout";
import { getDialogTimerHeaderGap } from "./timerBarStyles";
import { TimedPromptDialog } from "./TimedPromptDialog";
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
  private prompt: TimedPromptDialog<boolean>;

  constructor(scene: Phaser.Scene, timerController?: TurnTimerController) {
    const cfg = {
      ...DEFAULT_CARD_DIALOG_CONFIG,
      z: { ...DEFAULT_CARD_DIALOG_CONFIG.z, dialog: 3000 },
    };
    this.prompt = new TimedPromptDialog<boolean>(scene, timerController, cfg);
  }

  async showPrompt(opts: ChooseFirstPlayerDialogOpts): Promise<boolean> {
    const headerText = "Choose Turn Order";
    const firstLabel = opts.firstLabel || "Go First";
    const secondLabel = opts.secondLabel || "Go Second";
    const defaultAction = opts.onFirst ?? opts.onSecond;
    return this.prompt.showPrompt({
      headerText,
      promptText: "",
      buttons: [
        { label: firstLabel, result: true, onClick: opts.onFirst },
        { label: secondLabel, result: false, onClick: opts.onSecond },
      ],
      timeoutResult: true,
      onTimeout: defaultAction,
      showOverlay: false,
      closeOnBackdrop: false,
      showCloseButton: false,
      headerGap: getDialogTimerHeaderGap(),
    });
  }

  private destroy() {
    this.prompt.destroy();
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
