import Phaser from "phaser";
import { DEFAULT_CARD_DIALOG_CONFIG } from "./CardDialogLayout";
import { getDialogTimerHeaderGap } from "./timerBarStyles";
import { TimedPromptDialog } from "./TimedPromptDialog";
import type { TurnTimerController } from "../controllers/TurnTimerController";

type MulliganDialogOpts = {
  prompt?: string;
  onYes?: () => Promise<void> | void;
  onNo?: () => Promise<void> | void;
  headerText?: string;
  headerFontSize?: number;
};

/**
 * Mulligan prompt styled like other dialogs. Only buttons are interactive.
 */
export class MulliganDialog {
  private prompt: TimedPromptDialog<boolean>;

  constructor(scene: Phaser.Scene, timerController?: TurnTimerController) {
    const cfg = {
      ...DEFAULT_CARD_DIALOG_CONFIG,
      z: { ...DEFAULT_CARD_DIALOG_CONFIG.z, dialog: 3000 },
    };
    this.prompt = new TimedPromptDialog<boolean>(scene, timerController, cfg);
  }

  async showPrompt(opts: MulliganDialogOpts): Promise<boolean> {
    const headerText = opts.headerText ?? (opts.prompt ? opts.prompt : "Do you want mulligan?");
    const promptText = opts.headerText ? opts.prompt ?? "" : "";
    return this.prompt.showPrompt({
      headerText,
      promptText,
      buttons: [
        { label: "Yes", result: true, onClick: opts.onYes },
        { label: "No", result: false, onClick: opts.onNo },
      ],
      timeoutResult: true,
      onTimeout: opts.onYes,
      showOverlay: false,
      closeOnBackdrop: false,
      showCloseButton: false,
      headerFontSize: opts.headerFontSize,
      headerGap: getDialogTimerHeaderGap(),
    });
  }

  private destroy() {
    this.prompt.destroy();
  }

  getAutomationState() {
    return this.prompt.getAutomationState();
  }

  async choose(decision: "yes" | "no"): Promise<boolean> {
    const state = this.prompt.getAutomationState();
    if (!state) return false;
    if (decision === "yes") return this.prompt.choose(0);
    return this.prompt.choose(1);
  }
}
