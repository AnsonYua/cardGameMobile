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
  private lastState?: {
    headerText: string;
    promptText: string;
    buttons: Array<{ label: string; enabled: boolean }>;
  };
  private chooseHandlers: Array<() => Promise<void>> = [];
  private closing = false;

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
      const close = async (result: T, cb?: () => Promise<void> | void) => {
        if (this.closing) return;
        this.closing = true;
        if (!this.container) return;
        this.dialogTimer.stop();
        this.buttonTargets.forEach((btn) => btn.disableInteractive());
        await cb?.();
        animateDialogOut(this.scene, this.container, () => {
          this.destroy();
          resolve(result);
        });
      };

      this.lastState = {
        headerText: opts.headerText,
        promptText: opts.promptText ?? "",
        buttons: opts.buttons.map((button) => ({ label: button.label, enabled: true })),
      };
      this.chooseHandlers = opts.buttons.map(
        (button) => async () => {
          await close(button.result, button.onClick);
        },
      );

      const dialog = createPromptDialog(this.scene, this.cfg, {
        headerText: opts.headerText,
        promptText: opts.promptText ?? "",
        buttons: opts.buttons.map((btn, index) => ({
          label: btn.label,
          onClick: async () => this.chooseHandlers[index]?.(),
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
    this.lastState = undefined;
    this.chooseHandlers = [];
    this.closing = false;
  }

  isOpen() {
    return !!this.container;
  }

  getAutomationState() {
    if (!this.container || !this.lastState) return null;
    return {
      open: true,
      headerText: this.lastState.headerText,
      promptText: this.lastState.promptText,
      buttons: this.lastState.buttons.map((button) => ({
        label: button.label,
        enabled: button.enabled,
      })),
    };
  }

  async choose(labelOrIndex: string | number): Promise<boolean> {
    if (!this.container || !this.lastState) return false;
    let index = -1;
    if (typeof labelOrIndex === "number") {
      index = labelOrIndex;
    } else {
      index = this.lastState.buttons.findIndex((button) => button.label.toLowerCase() === labelOrIndex.toLowerCase());
    }
    if (index < 0 || index >= this.chooseHandlers.length) return false;
    const handler = this.chooseHandlers[index];
    if (!handler) return false;
    await handler();
    return true;
  }
}
