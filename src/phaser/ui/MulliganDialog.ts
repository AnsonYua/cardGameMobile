import Phaser from "phaser";
import { DEFAULT_CARD_DIALOG_CONFIG, computeDialogLayout, createDialogShell } from "./CardDialogLayout";

type MulliganDialogOpts = {
  prompt?: string;
  onYes?: () => Promise<void> | void;
  onNo?: () => Promise<void> | void;
};

/**
 * Mulligan prompt styled like other dialogs. Only buttons are interactive.
 */
export class MulliganDialog {
  private container?: Phaser.GameObjects.Container;
  private cfg = {
    ...DEFAULT_CARD_DIALOG_CONFIG,
    z: { ...DEFAULT_CARD_DIALOG_CONFIG.z, dialog: 3000 },
  };

  constructor(private scene: Phaser.Scene) {}

  async showPrompt(opts: MulliganDialogOpts): Promise<boolean> {
    this.destroy();

    const cam = this.scene.cameras.main;
    const headerText = "Mulligan";
    const promptText = opts.prompt || "Do you want to mulligan?";
    const maxTextWidth = Math.min(420, cam.width * 0.75);

    const layout = computeDialogLayout(cam, this.cfg, { cols: 1, visibleRows: 1 });
    const { dialog, content, header } = createDialogShell(this.scene, this.cfg, layout, {
      centerX: cam.centerX,
      centerY: cam.centerY,
      headerText,
      showOverlay: false,
      closeOnBackdrop: false,
      showCloseButton: false,
    });

    const prompt = this.scene.add.text(0, 0, promptText, {
      fontSize: "16px",
      fontFamily: "Arial",
      fontStyle: "bold",
      color: "#f5f6f7",
      align: "center",
      wordWrap: { width: maxTextWidth },
    }).setOrigin(0.5);

    const gap = 14;
    const buttonHeight = 46;
    const dialogMargin = this.cfg.dialog.margin;
    const buttonGap = 24;
    const availableForButtons = Math.max(200, layout.dialogWidth - dialogMargin * 2);
    const buttonWidth = Math.min(220, (availableForButtons - buttonGap) / 2);
    const promptY = header.y + header.height / 2 + gap + prompt.height / 2;
    prompt.setY(promptY);
    const btnY = promptY + prompt.height / 2 + gap + buttonHeight / 2;

    const makeButton = (x: number, label: string, onClick: () => Promise<void> | void) => {
      const rect = this.scene.add.rectangle(x, btnY, buttonWidth, buttonHeight, 0x2f3238, 1);
      rect.setStrokeStyle(2, 0x5b6068, 1);
      rect.setInteractive({ useHandCursor: true });
      rect.on("pointerup", async () => {
        await onClick();
      });

      const txt = this.scene.add.text(x, btnY, label, {
        fontSize: "15px",
        fontFamily: "Arial",
        fontStyle: "bold",
        color: "#f5f6f7",
        align: "center",
        wordWrap: { width: buttonWidth - 18 },
      });
      txt.setOrigin(0.5);
      return [rect, txt];
    };

    const offset = buttonWidth / 2 + buttonGap / 2;
    content.add(prompt);

    this.container = dialog;
    this.container.setAlpha(0).setScale(0.96);

    return new Promise<boolean>((resolve) => {
      let closing = false;
      const close = async (
        result: boolean,
        cb?: () => Promise<void> | void,
        buttons?: Phaser.GameObjects.Rectangle[],
      ) => {
        if (closing) return;
        closing = true;
        if (!this.container) return;
        buttons?.forEach((btn) => btn.disableInteractive());
        await cb?.();
        this.scene.tweens.add({
          targets: this.container,
          alpha: 0,
          scale: 1.02,
          duration: 140,
          ease: "Sine.easeIn",
          onComplete: () => {
            this.destroy();
            resolve(result);
          },
        });
      };

      let yesBtn: Phaser.GameObjects.Rectangle;
      let noBtn: Phaser.GameObjects.Rectangle;
      let yesTxt: Phaser.GameObjects.Text;
      let noTxt: Phaser.GameObjects.Text;

      [yesBtn, yesTxt] = makeButton(-offset, "Yes", async () => {
        await close(true, opts.onYes, [yesBtn, noBtn]);
      });
      [noBtn, noTxt] = makeButton(offset, "No", async () => {
        await close(false, opts.onNo, [yesBtn, noBtn]);
      });
      content.add([yesBtn, yesTxt, noBtn, noTxt]);

      this.scene.tweens.add({
        targets: this.container,
        alpha: 1,
        scale: 1,
        duration: 160,
        ease: "Back.easeOut",
      });
    });
  }

  private destroy() {
    this.container?.destroy();
    this.container = undefined;
  }
}
