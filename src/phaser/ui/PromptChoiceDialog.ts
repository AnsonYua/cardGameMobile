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
  private automationState?: {
    headerText: string;
    promptText: string;
    buttons: Array<{ label: string; enabled: boolean; onClick: () => Promise<void> | void }>;
  };
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
    this.automationState = {
      headerText: opts.headerText,
      promptText: opts.promptText ?? "",
      buttons: opts.buttons.map((button) => ({
        label: button.label,
        enabled: button.enabled !== false,
        onClick: button.onClick,
      })),
    };
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

  getAutomationState() {
    if (!this.container || !this.automationState) return null;
    return {
      open: true,
      headerText: this.automationState.headerText,
      promptText: this.automationState.promptText,
      buttons: this.automationState.buttons.map((button) => ({
        label: button.label,
        enabled: button.enabled,
      })),
    };
  }

  async choose(labelOrIndex: string | number): Promise<boolean> {
    if (!this.container || !this.automationState) return false;
    const buttons = this.automationState.buttons;
    let target = typeof labelOrIndex === "number" ? buttons[labelOrIndex] : undefined;
    if (!target && typeof labelOrIndex === "string") {
      target = buttons.find((button) => button.label.toLowerCase() === labelOrIndex.toLowerCase());
    }
    if (!target || target.enabled === false) return false;
    await Promise.resolve(target.onClick());
    return true;
  }

  private destroy() {
    this.dialogTimer.stop();
    if (!this.container) return;
    const target = this.container;
    this.container = undefined;
    this.automationState = undefined;
    animateDialogOut(this.scene, target, () => target.destroy());
  }
}
