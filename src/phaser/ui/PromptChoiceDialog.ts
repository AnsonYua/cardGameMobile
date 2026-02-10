import type Phaser from "phaser";
import { DEFAULT_CARD_DIALOG_CONFIG } from "./CardDialogLayout";
import { animateDialogIn, animateDialogOut } from "./DialogAnimator";
import { createPromptDialog } from "./PromptDialog";
import { getDialogTimerHeaderGap } from "./timerBarStyles";
import { DialogTimerPresenter } from "./DialogTimerPresenter";
import type { TurnTimerController } from "../controllers/TurnTimerController";

export type PromptChoiceDialogButton = {
  label: string;
  enabled?: boolean;
  onClick: () => Promise<void> | void;
};

export type PromptChoiceDialogOptions = {
  headerText: string;
  promptText?: string;
  buttons: PromptChoiceDialogButton[];
  showOverlay?: boolean;
  showTimer?: boolean;
  onTimeout?: () => Promise<void> | void;
};

export class PromptChoiceDialog {
  private container?: Phaser.GameObjects.Container;
  private dialogTimer: DialogTimerPresenter;
  private cfg = {
    ...DEFAULT_CARD_DIALOG_CONFIG,
    z: { ...DEFAULT_CARD_DIALOG_CONFIG.z, dialog: 3050 },
  };

  constructor(private scene: Phaser.Scene, timerController?: TurnTimerController) {
    this.dialogTimer = new DialogTimerPresenter(scene, timerController);
  }

  isOpen() {
    return !!this.container;
  }

  hide() {
    this.destroy();
  }

  show(opts: PromptChoiceDialogOptions) {
    this.destroy();
    const dialog = createPromptDialog(this.scene, this.cfg, {
      headerText: opts.headerText,
      promptText: opts.promptText,
      buttons: opts.buttons,
      showOverlay: opts.showOverlay ?? true,
      closeOnBackdrop: false,
      showCloseButton: false,
      headerGap: getDialogTimerHeaderGap(),
    });
    this.container = dialog.dialog;
    if (opts.showTimer) {
      this.dialogTimer.attach(dialog.dialog, dialog.layout, async () => {
        await opts.onTimeout?.();
      });
    }
    animateDialogIn(this.scene, this.container);
  }

  private destroy() {
    this.dialogTimer.stop();
    if (!this.container) return;
    const target = this.container;
    this.container = undefined;
    animateDialogOut(this.scene, target, () => target.destroy());
  }
}

