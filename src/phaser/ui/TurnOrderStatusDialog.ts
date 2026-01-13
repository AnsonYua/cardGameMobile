import Phaser from "phaser";
import { DEFAULT_CARD_DIALOG_CONFIG } from "./CardDialogLayout";
import { animateDialogIn, animateDialogOut } from "./DialogAnimator";
import { createPromptDialog } from "./PromptDialog";

export class TurnOrderStatusDialog {
  private container?: Phaser.GameObjects.Container;
  private currentPrompt?: string;
  private currentHeader?: string;
  private cfg = {
    ...DEFAULT_CARD_DIALOG_CONFIG,
    z: { ...DEFAULT_CARD_DIALOG_CONFIG.z, dialog: 3000 },
  };

  constructor(private scene: Phaser.Scene) {}

  showMessage(promptText: string, headerText = "Turn Order") {
    if (this.container && this.currentPrompt === promptText && this.currentHeader === headerText) {
      return;
    }
    this.destroy();
    this.currentPrompt = promptText;
    this.currentHeader = headerText;

    const dialog = createPromptDialog(this.scene, this.cfg, {
      headerText,
      promptText,
      buttons: [],
      showOverlay: false,
      closeOnBackdrop: false,
      showCloseButton: false,
    });
    this.container = dialog.dialog;
    animateDialogIn(this.scene, this.container);
  }

  hide() {
    if (!this.container) return;
    this.currentPrompt = undefined;
    this.currentHeader = undefined;
    const container = this.container;
    this.container = undefined;
    animateDialogOut(this.scene, container, () => {
      container.destroy();
    });
  }

  private destroy() {
    this.container?.destroy();
    this.container = undefined;
    this.currentPrompt = undefined;
    this.currentHeader = undefined;
  }
}
