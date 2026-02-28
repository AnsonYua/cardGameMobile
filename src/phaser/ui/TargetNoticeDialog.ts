import Phaser from "phaser";
import { DEFAULT_CARD_DIALOG_CONFIG } from "./CardDialogLayout";
import { createPromptDialog } from "./PromptDialog";
import { animateDialogIn, animateDialogOut } from "./DialogAnimator";

export type TargetNoticeDialogOpts = {
  headerText?: string;
  message: string;
  holdMs?: number;
};

export class TargetNoticeDialog {
  private container?: Phaser.GameObjects.Container;
  private holdTimer?: Phaser.Time.TimerEvent;
  private cfg = {
    ...DEFAULT_CARD_DIALOG_CONFIG,
    z: { ...DEFAULT_CARD_DIALOG_CONFIG.z, dialog: 3020 },
  };

  constructor(private scene: Phaser.Scene) {}

  async showNotice(opts: TargetNoticeDialogOpts): Promise<void> {
    this.destroyImmediate();

    const headerText = opts.headerText ?? "Targeted Effect";
    const message = (opts.message ?? "").trim();
    if (!message) return;
    const holdMs = Number.isFinite(opts.holdMs) ? Math.max(200, Number(opts.holdMs)) : 1600;

    const dialog = createPromptDialog(this.scene, this.cfg, {
      headerText,
      promptText: message,
      buttons: [],
      showOverlay: false,
      closeOnBackdrop: false,
      showCloseButton: false,
    });
    this.container = dialog.dialog;
    animateDialogIn(this.scene, dialog.dialog);

    await new Promise<void>((resolve) => {
      this.holdTimer = this.scene.time.delayedCall(holdMs, () => {
        this.holdTimer = undefined;
        void this.hide().then(resolve);
      });
    });
  }

  async hide(): Promise<void> {
    if (!this.container) return;
    this.holdTimer?.remove(false);
    this.holdTimer = undefined;
    const target = this.container;
    this.container = undefined;
    await new Promise<void>((resolve) => {
      animateDialogOut(this.scene, target, () => {
        target.destroy();
        resolve();
      });
    });
  }

  destroy() {
    this.destroyImmediate();
  }

  private destroyImmediate() {
    this.holdTimer?.remove(false);
    this.holdTimer = undefined;
    this.container?.destroy();
    this.container = undefined;
  }
}
