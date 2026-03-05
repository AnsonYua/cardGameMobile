import Phaser from "phaser";
import { DEFAULT_CARD_DIALOG_CONFIG } from "./CardDialogLayout";
import { SimplePromptModal } from "./dialog/SimplePromptModal";

export class TurnOrderStatusDialog {
  private modal: SimplePromptModal;
  private currentPrompt?: string;
  private currentHeader?: string;
  private cfg = {
    ...DEFAULT_CARD_DIALOG_CONFIG,
    z: { ...DEFAULT_CARD_DIALOG_CONFIG.z, dialog: 3000 },
  };

  constructor(private scene: Phaser.Scene) {
    this.modal = new SimplePromptModal(scene, this.cfg);
  }

  showMessage(promptText: string, headerText = "Turn Order") {
    if (this.modal.isOpen() && this.currentPrompt === promptText && this.currentHeader === headerText) {
      return;
    }
    this.destroy();
    this.currentPrompt = promptText;
    this.currentHeader = headerText;

    this.modal.show({
      headerText,
      promptText,
      buttons: [],
      showOverlay: false,
      closeOnBackdrop: false,
      showCloseButton: false,
    });
  }

  hide() {
    if (!this.modal.isOpen()) return;
    this.currentPrompt = undefined;
    this.currentHeader = undefined;
    void this.modal.hide();
  }

  private destroy() {
    this.modal.destroyImmediate();
    this.currentPrompt = undefined;
    this.currentHeader = undefined;
  }
}
