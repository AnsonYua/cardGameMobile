import Phaser from "phaser";
import { DEFAULT_CARD_DIALOG_CONFIG } from "./CardDialogLayout";
import { animateDialogIn, animateDialogOut } from "./DialogAnimator";
import { attachDialogTimerBar } from "./DialogTimerBar";
import { DialogTimerHandle } from "./DialogTimerHandle";
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
  private dialogTimer: DialogTimerHandle;

  constructor(private scene: Phaser.Scene, timerController?: TurnTimerController) {
    this.dialogTimer = new DialogTimerHandle(timerController);
  }

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
        this.dialogTimer.stop();
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
      this.dialogTimer.start(this.timerBar, async () => {
        await close(true, opts.onYes, buttons);
      });

      animateDialogIn(this.scene, this.container);
    });
  }

  private destroy() {
    this.dialogTimer.stop();
    this.container?.destroy();
    this.timerBar?.destroy();
    this.container = undefined;
    this.timerBar = undefined;
  }
}
