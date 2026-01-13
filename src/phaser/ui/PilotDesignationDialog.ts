import Phaser from "phaser";
import { DEFAULT_CARD_DIALOG_CONFIG } from "./CardDialogLayout";
import { createPromptDialog } from "./PromptDialog";

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
  private cfg = {
    ...DEFAULT_CARD_DIALOG_CONFIG,
    z: { ...DEFAULT_CARD_DIALOG_CONFIG.z, dialog: 3000 },
  };

  constructor(private scene: Phaser.Scene) {}

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
    this.container.setAlpha(0).setScale(0.96);
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      scale: 1,
      duration: 160,
      ease: "Back.easeOut",
    });
  }

  async hide(onClose?: () => void): Promise<void> {
    if (!this.container) return;
    const target = this.container;
    this.container = undefined;
    this.scene.tweens.add({
      targets: target,
      alpha: 0,
      scale: 1.02,
      duration: 140,
      ease: "Sine.easeIn",
      onComplete: () => {
        target.destroy();
        onClose?.();
      },
    });
  }

  private destroy() {
    this.container?.destroy();
    this.container = undefined;
  }
}
