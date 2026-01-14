import Phaser from "phaser";
import type { CardDialogConfig } from "./CardDialogLayout";
import { DEFAULT_CARD_DIALOG_CONFIG } from "./CardDialogLayout";
import { animateDialogIn, animateDialogOut } from "./DialogAnimator";
import { DialogTimerPresenter } from "./DialogTimerPresenter";
import { createPromptDialog } from "./PromptDialog";
import type { TurnTimerController } from "../controllers/TurnTimerController";

export type TimedPromptButton<T> = {
  label: string;
  result: T;
  onClick?: () => Promise<void> | void;
};

export type TimedPromptDialogOptions<T> = {
  headerText: string;
  promptText?: string;
  buttons: TimedPromptButton<T>[];
  timeoutResult: T;
  onTimeout?: () => Promise<void> | void;
  headerFontSize?: number;
  headerGap?: number;
  showOverlay?: boolean;
  closeOnBackdrop?: boolean;
  showCloseButton?: boolean;
  onClose?: () => void;
};

export class TimedPromptDialog<T> {
  private container?: Phaser.GameObjects.Container;
  private buttonTargets: Phaser.GameObjects.Rectangle[] = [];
  private dialogTimer: DialogTimerPresenter;
  private cfg: CardDialogConfig;

  constructor(
    private scene: Phaser.Scene,
    timerController?: TurnTimerController,
    cfg: CardDialogConfig = DEFAULT_CARD_DIALOG_CONFIG,
  ) {
    this.dialogTimer = new DialogTimerPresenter(scene, timerController);
    this.cfg = cfg;
  }

  async showPrompt(opts: TimedPromptDialogOptions<T>): Promise<T> {
    this.destroy();
    return new Promise<T>((resolve) => {
      let closing = false;
      const close = async (result: T, cb?: () => Promise<void> | void) => {
        if (closing) return;
        closing = true;
        if (!this.container) return;
        this.dialogTimer.stop();
        this.buttonTargets.forEach((btn) => btn.disableInteractive());
        await cb?.();
        animateDialogOut(this.scene, this.container, () => {
          this.destroy();
          resolve(result);
        });
      };

      const dialog = createPromptDialog(this.scene, this.cfg, {
        headerText: opts.headerText,
        promptText: opts.promptText ?? "",
        buttons: opts.buttons.map((btn) => ({
          label: btn.label,
          onClick: async () => {
            await close(btn.result, btn.onClick);
          },
        })),
        showOverlay: opts.showOverlay ?? false,
        closeOnBackdrop: opts.closeOnBackdrop ?? false,
        showCloseButton: opts.showCloseButton ?? false,
        onClose: opts.onClose,
        headerFontSize: opts.headerFontSize,
        headerGap: opts.headerGap,
      });
      this.container = dialog.dialog;
      this.buttonTargets = dialog.buttons.map((btn) => btn.rect);
      this.dialogTimer.attach(dialog.dialog, dialog.layout, async () => {
        await close(opts.timeoutResult, opts.onTimeout);
      });
      animateDialogIn(this.scene, this.container);
    });
  }

  destroy() {
    this.dialogTimer.stop();
    this.container?.destroy();
    this.container = undefined;
    this.buttonTargets = [];
  }
}
