import Phaser from "phaser";
import { DEFAULT_CARD_DIALOG_CONFIG, computePromptDialogLayout, createDialogShell } from "./CardDialogLayout";

type ChooseFirstPlayerDialogOpts = {
  prompt?: string;
  onFirst?: () => Promise<void> | void;
  onSecond?: () => Promise<void> | void;
  firstLabel?: string;
  secondLabel?: string;
};

/**
 * Turn order dialog styled like the mulligan prompt.
 */
export class ChooseFirstPlayerDialog {
  private container?: Phaser.GameObjects.Container;
  private cfg = {
    ...DEFAULT_CARD_DIALOG_CONFIG,
    z: { ...DEFAULT_CARD_DIALOG_CONFIG.z, dialog: 3000 },
  };

  constructor(private scene: Phaser.Scene) {}

  async showPrompt(opts: ChooseFirstPlayerDialogOpts): Promise<boolean> {
    this.destroy();

    const cam = this.scene.cameras.main;
    const headerText = "Choose Turn Order";
    const promptText = opts.prompt || "Choose who goes first.";
    const maxTextWidth = Math.min(420, cam.width * 0.75);
    const headerStyle = {
      fontSize: "20px",
      fontFamily: "Arial",
      fontStyle: "bold",
      color: "#f5f6f7",
      align: "center",
    };
    const promptStyle = {
      fontSize: "16px",
      fontFamily: "Arial",
      fontStyle: "bold",
      color: "#f5f6f7",
      align: "center",
      wordWrap: { width: maxTextWidth },
    };

    const tempHeader = this.scene.add.text(-10000, -10000, headerText, headerStyle).setOrigin(0.5);
    const tempPrompt = this.scene.add.text(-10000, -10000, promptText, promptStyle).setOrigin(0.5);
    const gap = 14;
    const buttonHeight = 46;
    const buttonContentHeight = tempPrompt.height + gap + buttonHeight;
    const layout = computePromptDialogLayout(cam, this.cfg, {
      contentWidth: Math.max(tempPrompt.width, 260),
      contentHeight: buttonContentHeight,
      headerHeight: tempHeader.height,
    });
    tempHeader.destroy();
    tempPrompt.destroy();

    const { dialog, content, header } = createDialogShell(this.scene, this.cfg, layout, {
      centerX: cam.centerX,
      centerY: cam.centerY,
      headerText,
      showOverlay: false,
      closeOnBackdrop: false,
      showCloseButton: false,
    });

    const prompt = this.scene.add.text(0, 0, promptText, promptStyle).setOrigin(0.5);

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

      let firstBtn: Phaser.GameObjects.Rectangle;
      let secondBtn: Phaser.GameObjects.Rectangle;
      let firstTxt: Phaser.GameObjects.Text;
      let secondTxt: Phaser.GameObjects.Text;

      const firstLabel = opts.firstLabel || "Go First";
      const secondLabel = opts.secondLabel || "Go Second";

      [firstBtn, firstTxt] = makeButton(-offset, firstLabel, async () => {
        await close(true, opts.onFirst, [firstBtn, secondBtn]);
      });
      [secondBtn, secondTxt] = makeButton(offset, secondLabel, async () => {
        await close(false, opts.onSecond, [firstBtn, secondBtn]);
      });
      content.add([firstBtn, firstTxt, secondBtn, secondTxt]);

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
