import Phaser from "phaser";
import { DEFAULT_CARD_DIALOG_CONFIG } from "./CardDialogLayout";
import { animateDialogIn, animateDialogOut } from "./DialogAnimator";
import { getDialogTimerHeaderGap } from "./timerBarStyles";
import { DialogTimerPresenter } from "./DialogTimerPresenter";
import { createPromptDialog } from "./PromptDialog";
import type { TurnTimerController } from "../controllers/TurnTimerController";
import { runDismissFirstSubmit } from "./dialog/runDismissFirstSubmit";

type PilotDesignationDialogOpts = {
  onPilot: () => Promise<void> | void;
  onCommand: () => Promise<void> | void;
  onClose?: () => void;
  allowPilot?: boolean;
  allowCommand?: boolean;
};

/**
 * Simple two-option dialog (Pilot / Command) for pilot-designation commands.
 * Renders its own overlay and panel; exposes show/hide so BoardScene stays lean.
 */
export class PilotDesignationDialog {
  private container?: Phaser.GameObjects.Container;
  private dialogTimer: DialogTimerPresenter;
  private interactiveTargets: Array<{ disableInteractive?: () => unknown }> = [];
  private submitting = false;
  private closing = false;
  private cfg = {
    ...DEFAULT_CARD_DIALOG_CONFIG,
    z: { ...DEFAULT_CARD_DIALOG_CONFIG.z, dialog: 3000 },
  };

  constructor(private scene: Phaser.Scene, timerController?: TurnTimerController) {
    this.dialogTimer = new DialogTimerPresenter(scene, timerController);
  }

  show(opts: PilotDesignationDialogOpts) {
    this.destroy();
    this.submitting = false;
    this.closing = false;
    this.interactiveTargets = [];
    const headerText = "Play Card As";
    const allowPilot = opts.allowPilot !== false;
    const allowCommand = opts.allowCommand !== false;
    const buttons = [];
    if (allowPilot) {
      buttons.push({
        label: "Pilot",
        enabled: true,
        onClick: async () => {
          await this.runLocked(opts.onPilot, opts.onClose);
        },
      });
    } else {
      buttons.push({
        label: "Pilot",
        enabled: false,
        onClick: async () => {},
      });
    }
    if (allowCommand) {
      buttons.push({
        label: "Command",
        onClick: async () => {
          await this.runLocked(opts.onCommand, opts.onClose);
        },
      });
    }
    const dialog = createPromptDialog(this.scene, this.cfg, {
      headerText,
      buttons,
      showOverlay: true,
      closeOnBackdrop: false,
      showCloseButton: true,
      onClose: () => {
        if (this.submitting || this.closing) return;
        void this.hide(opts.onClose);
      },
      headerGap: getDialogTimerHeaderGap(),
    });
    this.container = dialog.dialog;
    this.interactiveTargets = dialog.buttons.map((button) => button.rect);
    if (dialog.closeButton) this.interactiveTargets.push(dialog.closeButton);
    if (dialog.closeLabel) this.interactiveTargets.push(dialog.closeLabel);
    const defaultAction = allowPilot ? opts.onPilot : allowCommand ? opts.onCommand : opts.onPilot;
    this.dialogTimer.attach(dialog.dialog, dialog.layout, async () => {
      await this.runLocked(defaultAction, opts.onClose);
    });
    animateDialogIn(this.scene, this.container);
  }

  async hide(onClose?: () => void): Promise<void> {
    if (!this.container || this.closing) return;
    this.disableInteractiveTargets();
    this.closing = true;
    const target = this.container;
    this.container = undefined;
    this.dialogTimer.stop();
    animateDialogOut(this.scene, target, () => {
      this.interactiveTargets = [];
      this.closing = false;
      target.destroy();
      onClose?.();
    });
  }

  private destroy() {
    this.dialogTimer.stop();
    this.submitting = false;
    this.closing = false;
    this.interactiveTargets = [];
    this.container?.destroy();
    this.container = undefined;
  }

  private disableInteractiveTargets() {
    this.interactiveTargets.forEach((target) => target.disableInteractive?.());
  }

  private async runLocked(action?: () => Promise<void> | void, onClose?: () => void) {
    if (!action || this.submitting || this.closing) return;
    await runDismissFirstSubmit({
      isSubmitting: this.submitting,
      setSubmitting: (submitting) => {
        this.submitting = submitting;
      },
      beforeDismiss: () => {
        this.disableInteractiveTargets();
      },
      dismiss: () => this.hide(onClose),
      submit: action,
    });
  }
}
