import Phaser from "phaser";
import { DEFAULT_CARD_DIALOG_CONFIG } from "./CardDialogLayout";
import { SimplePromptModal } from "./dialog/SimplePromptModal";
import type { PromptDialogButton } from "./PromptDialog";

export type ErrorDialogOpts = {
  headerText?: string;
  message: string;
  onOk?: () => Promise<void> | void;
  buttons?: PromptDialogButton[];
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
    const buttons =
      Array.isArray(opts.buttons) && opts.buttons.length > 0
        ? opts.buttons.map((button) => ({
            ...button,
            onClick: async () => {
              await button.onClick?.();
              await this.hide();
            },
          }))
        : [
            {
              label: "OK",
              onClick: async () => {
                await opts.onOk?.();
                await this.hide();
              },
            },
          ];
    this.modal.show({
      headerText,
      promptText: message,
      buttons,
      showOverlay: true,
      closeOnBackdrop: false,
      showCloseButton: false,
    });
  }

  async hide() {
    await this.modal.hide();
  }
}
