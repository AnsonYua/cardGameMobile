import Phaser from "phaser";
import { DEFAULT_CARD_DIALOG_CONFIG } from "./CardDialogLayout";
import { createPromptDialog } from "./PromptDialog";

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

  constructor(private scene: Phaser.Scene) {}

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
        buttonTargets?.forEach((btn) => btn.disableInteractive());
        await cb?.();
        this.scene.tweens.add({
          targets: this.container,
          alpha: 0,
          scale: 1.02,
          duration: 140,
          ease: "Sine.easeIn",
          onComplete: () => {
            this.destroy();
            resolve(result);
          },
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
      this.container.setAlpha(0).setScale(0.96);
      buttons = dialog.buttons.map((btn) => btn.rect);

      this.scene.tweens.add({
        targets: this.container,
        alpha: 1,
        scale: 1,
        duration: 160,
        ease: "Back.easeOut",
      });
    });
  }

  private destroy() {
    this.container?.destroy();
    this.container = undefined;
  }
}
