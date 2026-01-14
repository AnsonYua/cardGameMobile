import Phaser from "phaser";
import { DEFAULT_CARD_DIALOG_CONFIG } from "./CardDialogLayout";
import { animateDialogIn, animateDialogOut } from "./DialogAnimator";
import { attachDialogTimerBar } from "./DialogTimerBar";
import { DialogTimerHandle } from "./DialogTimerHandle";
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
  private timerBar?: ReturnType<typeof attachDialogTimerBar>;
  private dialogTimer: DialogTimerHandle;
  private cfg = {
    ...DEFAULT_CARD_DIALOG_CONFIG,
    z: { ...DEFAULT_CARD_DIALOG_CONFIG.z, dialog: 3000 },
  };

  constructor(private scene: Phaser.Scene, timerController?: TurnTimerController) {
    this.dialogTimer = new DialogTimerHandle(timerController);
  }

  show(opts: PilotDesignationDialogOpts) {
    this.destroy();
    const headerText = "Play Card As";
    const allowPilot = opts.allowPilot !== false;
    const buttons = [
      ...(allowPilot
        ? [
            {
              label: "Pilot",
              onClick: async () => {
                await this.hide(opts.onClose);
                await opts.onPilot();
              },
            },
          ]
        : []),
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
    });
    this.container = dialog.dialog;
    this.timerBar = attachDialogTimerBar(this.scene, dialog.dialog, dialog.layout);
    const defaultAction = allowPilot ? opts.onPilot : opts.onCommand;
    this.dialogTimer.start(this.timerBar, async () => {
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
    this.timerBar?.destroy();
    this.container = undefined;
    this.timerBar = undefined;
  }
}
