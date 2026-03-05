import Phaser from "phaser";
import { DEFAULT_CARD_DIALOG_CONFIG } from "./CardDialogLayout";
import { SimplePromptModal } from "./dialog/SimplePromptModal";

type GameOverDialogOpts = {
  isWinner: boolean;
  onOk: () => Promise<void> | void;
};

export class GameOverDialog {
  private modal: SimplePromptModal;
  private cfg = {
    ...DEFAULT_CARD_DIALOG_CONFIG,
    z: { ...DEFAULT_CARD_DIALOG_CONFIG.z, dialog: 3000 },
  };

  constructor(private scene: Phaser.Scene) {
    this.modal = new SimplePromptModal(scene, this.cfg);
  }

  show(opts: GameOverDialogOpts) {
    void this.hide();
    const headerText = opts.isWinner ? "You win the game" : "You lost the game";
    this.modal.show({
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
  }

  async hide() {
    await this.modal.hide();
  }
}
