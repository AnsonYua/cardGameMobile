import Phaser from "phaser";
import { DEFAULT_CARD_DIALOG_CONFIG } from "./CardDialogLayout";
import { SimplePromptModal } from "./dialog/SimplePromptModal";

export type TargetNoticeDialogOpts = {
  headerText?: string;
  message: string;
  holdMs?: number;
};

export class TargetNoticeDialog {
  private modal: SimplePromptModal;
  private holdTimer?: Phaser.Time.TimerEvent;
  private cfg = {
    ...DEFAULT_CARD_DIALOG_CONFIG,
    z: { ...DEFAULT_CARD_DIALOG_CONFIG.z, dialog: 3020 },
  };

  constructor(private scene: Phaser.Scene) {
    this.modal = new SimplePromptModal(scene, this.cfg);
  }

  async showNotice(opts: TargetNoticeDialogOpts): Promise<void> {
    this.destroyImmediate();

    const headerText = opts.headerText ?? "Targeted Effect";
    const message = (opts.message ?? "").trim();
    if (!message) return;
    const holdMs = Number.isFinite(opts.holdMs) ? Math.max(200, Number(opts.holdMs)) : 1600;

    this.modal.show({
      headerText,
      promptText: message,
      buttons: [],
      showOverlay: false,
      closeOnBackdrop: false,
      showCloseButton: false,
    });

    await new Promise<void>((resolve) => {
      this.holdTimer = this.scene.time.delayedCall(holdMs, () => {
        this.holdTimer = undefined;
        void this.hide().then(resolve);
      });
    });
  }

  async hide(): Promise<void> {
    if (!this.modal.isOpen()) return;
    this.holdTimer?.remove(false);
    this.holdTimer = undefined;
    await this.modal.hide();
  }

  destroy() {
    this.destroyImmediate();
  }

  private destroyImmediate() {
    this.holdTimer?.remove(false);
    this.holdTimer = undefined;
    this.modal.destroyImmediate();
  }
}
