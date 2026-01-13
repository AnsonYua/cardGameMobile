import Phaser from "phaser";
import { DEFAULT_CARD_DIALOG_CONFIG } from "./CardDialogLayout";
import { animateDialogIn, animateDialogOut } from "./DialogAnimator";
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
        animateDialogOut(this.scene, this.container, () => {
          this.destroy();
          resolve(result);
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
      buttons = dialog.buttons.map((btn) => btn.rect);

      animateDialogIn(this.scene, this.container);
    });
  }

  private destroy() {
    this.container?.destroy();
    this.container = undefined;
  }
}
