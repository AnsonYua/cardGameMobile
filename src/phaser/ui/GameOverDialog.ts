import Phaser from "phaser";
import { DEFAULT_CARD_DIALOG_CONFIG } from "./CardDialogLayout";
import { animateDialogIn, animateDialogOut } from "./DialogAnimator";
import { createPromptDialog } from "./PromptDialog";

type GameOverDialogOpts = {
  isWinner: boolean;
  onOk: () => Promise<void> | void;
};

export class GameOverDialog {
  private container?: Phaser.GameObjects.Container;
  private cfg = {
    ...DEFAULT_CARD_DIALOG_CONFIG,
    z: { ...DEFAULT_CARD_DIALOG_CONFIG.z, dialog: 3000 },
  };

  constructor(private scene: Phaser.Scene) {}

  show(opts: GameOverDialogOpts) {
    this.hide();
    const headerText = opts.isWinner ? "You win the game" : "You lost the game";
    const dialog = createPromptDialog(this.scene, this.cfg, {
      headerText,
      promptText: "",
      buttons: [
        {
          label: "OK",
          onClick: async () => {
            await opts.onOk();
            await this.hide();
          },
        },
      ],
      showOverlay: true,
      closeOnBackdrop: false,
      showCloseButton: false,
    });
    this.container = dialog.dialog;
    animateDialogIn(this.scene, this.container);
  }

  async hide() {
    if (!this.container) return;
    const target = this.container;
    this.container = undefined;
    animateDialogOut(this.scene, target, () => {
      target.destroy();
    });
  }
}
