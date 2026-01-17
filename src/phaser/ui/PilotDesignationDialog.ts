import Phaser from "phaser";
import { DEFAULT_CARD_DIALOG_CONFIG } from "./CardDialogLayout";
import { animateDialogIn, animateDialogOut } from "./DialogAnimator";
import { getDialogTimerHeaderGap } from "./timerBarStyles";
import { DialogTimerPresenter } from "./DialogTimerPresenter";
import { createPromptDialog } from "./PromptDialog";
import type { TurnTimerController } from "../controllers/TurnTimerController";

type PilotDesignationDialogOpts = {
  onPilot: () => Promise<void> | void;
  onCommand: () => Promise<void> | void;
  onClose?: () => void;
  allowPilot?: boolean;
};

/**
 * Simple two-option dialog (Pilot / Command) for pilot-designation commands.
 * Renders its own overlay and panel; exposes show/hide so BoardScene stays lean.
 */
export class PilotDesignationDialog {
  private container?: Phaser.GameObjects.Container;
  private dialogTimer: DialogTimerPresenter;
  private cfg = {
    ...DEFAULT_CARD_DIALOG_CONFIG,
    z: { ...DEFAULT_CARD_DIALOG_CONFIG.z, dialog: 3000 },
  };

  constructor(private scene: Phaser.Scene, timerController?: TurnTimerController) {
    this.dialogTimer = new DialogTimerPresenter(scene, timerController);
  }

  show(opts: PilotDesignationDialogOpts) {
    this.destroy();
    const headerText = "Play Card As";
    const allowPilot = opts.allowPilot !== false;
    const buttons = [
      {
        label: "Pilot",
        enabled: allowPilot,
        onClick: async () => {
          await this.hide(opts.onClose);
          await opts.onPilot();
        },
      },
      {
        label: "Command",
        onClick: async () => {
          await opts.onCommand();
          await this.hide(opts.onClose);
        },
      },
    ];
    const dialog = createPromptDialog(this.scene, this.cfg, {
      headerText,
      promptText: "Choose option",
      buttons,
      showOverlay: true,
      closeOnBackdrop: true,
      showCloseButton: true,
      onClose: () => void this.hide(opts.onClose),
      headerGap: getDialogTimerHeaderGap(),
    });
    this.container = dialog.dialog;
    const defaultAction = allowPilot ? opts.onPilot : opts.onCommand;
    this.dialogTimer.attach(dialog.dialog, dialog.layout, async () => {
      await this.hide(opts.onClose);
      await defaultAction();
    });
    animateDialogIn(this.scene, this.container);
  }

  async hide(onClose?: () => void): Promise<void> {
    if (!this.container) return;
    const target = this.container;
    this.container = undefined;
    this.dialogTimer.stop();
    animateDialogOut(this.scene, target, () => {
      target.destroy();
      onClose?.();
    });
  }

  private destroy() {
    this.dialogTimer.stop();
    this.container?.destroy();
    this.container = undefined;
  }
}
