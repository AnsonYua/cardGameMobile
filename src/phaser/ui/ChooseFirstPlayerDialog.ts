import Phaser from "phaser";
import { DEFAULT_CARD_DIALOG_CONFIG } from "./CardDialogLayout";
import { animateDialogIn, animateDialogOut } from "./DialogAnimator";
import { attachDialogTimerBar } from "./DialogTimerBar";
import { getDialogTimerHeaderGap } from "./timerBarStyles";
import { DialogTimerHandle } from "./DialogTimerHandle";
import { createPromptDialog } from "./PromptDialog";
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

  async showPrompt(opts: ChooseFirstPlayerDialogOpts): Promise<boolean> {
    this.destroy();

    const headerText = "Choose Turn Order";
    return new Promise<boolean>((resolve) => {
      let closing = false;
      let buttons: Phaser.GameObjects.Rectangle[] = [];
      const close = async (
        result: boolean,
        cb?: () => Promise<void> | void,
        buttons?: Phaser.GameObjects.Rectangle[],
      ) => {
        if (closing) return;
        closing = true;
        if (!this.container) return;
        this.dialogTimer.stop();
        buttons?.forEach((btn) => btn.disableInteractive());
        await cb?.();
        animateDialogOut(this.scene, this.container, () => {
          this.destroy();
          resolve(result);
        });
      };

      const firstLabel = opts.firstLabel || "Go First";
      const secondLabel = opts.secondLabel || "Go Second";

      const dialog = createPromptDialog(this.scene, this.cfg, {
        headerText,
        promptText: "",
        buttons: [
          {
            label: firstLabel,
            onClick: async () => {
              await close(true, opts.onFirst, buttons);
            },
          },
          {
            label: secondLabel,
            onClick: async () => {
              await close(false, opts.onSecond, buttons);
            },
          },
        ],
        showOverlay: false,
        closeOnBackdrop: false,
        showCloseButton: false,
        headerGap: getDialogTimerHeaderGap(),
      });
      this.container = dialog.dialog;
      buttons = dialog.buttons.map((btn) => btn.rect);
      this.timerBar = attachDialogTimerBar(this.scene, dialog.dialog, dialog.layout);
      const defaultAction = opts.onFirst ?? opts.onSecond;
      this.dialogTimer.start(this.timerBar, async () => {
        await close(true, defaultAction, buttons);
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
