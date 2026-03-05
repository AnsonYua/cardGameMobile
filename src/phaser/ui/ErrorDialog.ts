import Phaser from "phaser";
import { DEFAULT_CARD_DIALOG_CONFIG } from "./CardDialogLayout";
import { SimplePromptModal } from "./dialog/SimplePromptModal";

export type ErrorDialogOpts = {
  headerText?: string;
  message: string;
  onOk?: () => Promise<void> | void;
};

export class ErrorDialog {
  private modal: SimplePromptModal;
  private cfg = {
    ...DEFAULT_CARD_DIALOG_CONFIG,
    z: { ...DEFAULT_CARD_DIALOG_CONFIG.z, dialog: 3000 },
  };

  constructor(private scene: Phaser.Scene) {
    this.modal = new SimplePromptModal(scene, this.cfg);
  }

  show(opts: ErrorDialogOpts) {
    void this.hide();
    const headerText = opts.headerText ?? "Error";
    const message = (opts.message ?? "").trim() || "Something went wrong.";
    this.modal.show({
      headerText,
      promptText: message,
      buttons: [
        {
          label: "OK",
          onClick: async () => {
            await opts.onOk?.();
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
