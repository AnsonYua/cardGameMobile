import Phaser from "phaser";
import { DEFAULT_CARD_DIALOG_CONFIG } from "./CardDialogLayout";
import { animateDialogIn, animateDialogOut } from "./DialogAnimator";
import { attachDialogTimerBar } from "./DialogTimerBar";
import { createPromptDialog } from "./PromptDialog";
import type { TurnTimerController } from "../controllers/TurnTimerController";

type MulliganDialogOpts = {
  prompt?: string;
  onYes?: () => Promise<void> | void;
  onNo?: () => Promise<void> | void;
};

/**
 * Mulligan prompt styled like other dialogs. Only buttons are interactive.
 */
export class MulliganDialog {
  private container?: Phaser.GameObjects.Container;
  private cfg = {
    ...DEFAULT_CARD_DIALOG_CONFIG,
    z: { ...DEFAULT_CARD_DIALOG_CONFIG.z, dialog: 3000 },
  };

  private timerBar?: ReturnType<typeof attachDialogTimerBar>;
  private dialogTimerToken?: number;

  constructor(private scene: Phaser.Scene, private timerController?: TurnTimerController) {}

  async showPrompt(opts: MulliganDialogOpts): Promise<boolean> {
    this.destroy();

    const headerText = "Mulligan";
    const promptText = opts.prompt || "Do you want to mulligan?";
    return new Promise<boolean>((resolve) => {
      let closing = false;
      let buttons: Phaser.GameObjects.Rectangle[] = [];
      const close = async (
        result: boolean,
        cb?: () => Promise<void> | void,
        buttonTargets?: Phaser.GameObjects.Rectangle[],
      ) => {
        if (closing) return;
        closing = true;
        if (!this.container) return;
        this.stopDialogTimer();
        buttonTargets?.forEach((btn) => btn.disableInteractive());
        await cb?.();
        animateDialogOut(this.scene, this.container, () => {
          this.destroy();
          resolve(result);
        });
      };

      const dialog = createPromptDialog(this.scene, this.cfg, {
        headerText,
        promptText,
        buttons: [
          {
            label: "Yes",
            onClick: async () => {
              await close(true, opts.onYes, buttons);
            },
          },
          {
            label: "No",
            onClick: async () => {
              await close(false, opts.onNo, buttons);
            },
          },
        ],
        showOverlay: false,
        closeOnBackdrop: false,
        showCloseButton: false,
      });
      this.container = dialog.dialog;
      buttons = dialog.buttons.map((btn) => btn.rect);
      this.timerBar = attachDialogTimerBar(this.scene, dialog.dialog, dialog.layout);
      this.dialogTimerToken = this.timerController?.startDialogTimer(this.timerBar, async () => {
        await close(true, opts.onYes, buttons);
      });

      animateDialogIn(this.scene, this.container);
    });
  }

  private stopDialogTimer() {
    if (this.dialogTimerToken !== undefined) {
      this.timerController?.endDialogTimer(this.dialogTimerToken);
      this.dialogTimerToken = undefined;
    }
    this.timerController?.resumeTurnTimer();
  }

  private destroy() {
    this.stopDialogTimer();
    this.container?.destroy();
    this.timerBar?.destroy();
    this.container = undefined;
    this.timerBar = undefined;
  }
}
