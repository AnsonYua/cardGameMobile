import Phaser from "phaser";
import { DEFAULT_CARD_DIALOG_CONFIG } from "./CardDialogLayout";
import { SimplePromptModal } from "./dialog/SimplePromptModal";
import { runDismissFirstSubmit } from "./dialog/runDismissFirstSubmit";

type GameOverDialogOpts = {
  isWinner: boolean;
  onOk: () => Promise<void> | void;
};

export class GameOverDialog {
  private modal: SimplePromptModal;
  private submitting = false;
  private cfg = {
    ...DEFAULT_CARD_DIALOG_CONFIG,
    z: { ...DEFAULT_CARD_DIALOG_CONFIG.z, dialog: 3000 },
  };

  constructor(private scene: Phaser.Scene) {
    this.modal = new SimplePromptModal(scene, this.cfg);
  }

  show(opts: GameOverDialogOpts) {
    void this.hide();
    this.submitting = false;
    const headerText = opts.isWinner ? "You win the game" : "You lost the game";
    this.modal.show({
      headerText,
      promptText: "",
      buttons: [
        {
          label: "OK",
          onClick: async () => {
            await runDismissFirstSubmit({
              isSubmitting: this.submitting,
              setSubmitting: (submitting) => {
                this.submitting = submitting;
              },
              dismiss: () => this.hide(),
              submit: opts.onOk,
            });
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
