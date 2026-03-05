import type Phaser from "phaser";
import type { CardDialogConfig } from "../CardDialogLayout";
import { DEFAULT_CARD_DIALOG_CONFIG } from "../CardDialogLayout";
import { animateDialogIn, animateDialogOut } from "../DialogAnimator";
import { createPromptDialog, type PromptDialogButton } from "../PromptDialog";

type SimplePromptModalOptions = {
  headerText: string;
  promptText?: string;
  buttons?: PromptDialogButton[];
  showOverlay?: boolean;
  closeOnBackdrop?: boolean;
  showCloseButton?: boolean;
  onClose?: () => void;
  headerGap?: number;
  headerFontSize?: number;
};

export class SimplePromptModal {
  private container?: Phaser.GameObjects.Container;

  constructor(
    private scene: Phaser.Scene,
    private cfg: CardDialogConfig = DEFAULT_CARD_DIALOG_CONFIG,
  ) {}

  isOpen() {
    return !!this.container;
  }

  show(opts: SimplePromptModalOptions) {
    this.destroyImmediate();
    const dialog = createPromptDialog(this.scene, this.cfg, {
      headerText: opts.headerText,
      promptText: opts.promptText,
      buttons: opts.buttons ?? [],
      showOverlay: opts.showOverlay ?? false,
      closeOnBackdrop: opts.closeOnBackdrop ?? false,
      showCloseButton: opts.showCloseButton ?? false,
      onClose: opts.onClose,
      headerGap: opts.headerGap,
      headerFontSize: opts.headerFontSize,
    });
    this.container = dialog.dialog;
    animateDialogIn(this.scene, dialog.dialog);
    return dialog;
  }

  async hide(): Promise<void> {
    if (!this.container) return;
    const target = this.container;
    this.container = undefined;
    await new Promise<void>((resolve) => {
      animateDialogOut(this.scene, target, () => {
        target.destroy();
        resolve();
      });
    });
  }

  destroyImmediate() {
    this.container?.destroy();
    this.container = undefined;
  }
}

