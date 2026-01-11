import Phaser from "phaser";
import { DEFAULT_CARD_DIALOG_CONFIG, computePromptDialogLayout, createDialogShell } from "./CardDialogLayout";

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

    const cam = this.scene.cameras.main;
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
    const layout = computePromptDialogLayout(cam, this.cfg, {
      contentWidth: Math.max(tempPrompt.width, 260),
      contentHeight: tempPrompt.height + gap,
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
    const promptY = header.y + header.height / 2 + gap + prompt.height / 2;
    prompt.setY(promptY);
    content.add(prompt);

    this.container = dialog;
    this.container.setAlpha(0).setScale(0.96);
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      scale: 1,
      duration: 160,
      ease: "Back.easeOut",
    });
  }

  hide() {
    if (!this.container) return;
    this.currentPrompt = undefined;
    this.currentHeader = undefined;
    const container = this.container;
    this.container = undefined;
    this.scene.tweens.add({
      targets: container,
      alpha: 0,
      scale: 1.02,
      duration: 140,
      ease: "Sine.easeIn",
      onComplete: () => {
        container.destroy();
      },
    });
  }

  private destroy() {
    this.container?.destroy();
    this.container = undefined;
    this.currentPrompt = undefined;
    this.currentHeader = undefined;
  }
}
