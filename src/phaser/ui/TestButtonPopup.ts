import Phaser from "phaser";

type PopupButton = { label: string; onClick?: () => void };
export type TestButtonPopupConfig = Partial<Record<"button1" | "button2" | "button3" | "button4" | "button5" | "button6", PopupButton>> & {
  gameId?: string;
};

export class TestButtonPopup {
  private container?: Phaser.GameObjects.Container;
  private backdrop?: Phaser.GameObjects.Rectangle;
  private depth = 2000;
  private tweenDuration = 200;

  constructor(private scene: Phaser.Scene) {}

  show(config: TestButtonPopupConfig) {
    this.hide();
    const { width, height } = this.scene.scale;
    const popupW = 260;
    const popupH = 480;
    const centerX = width / 2;
    const centerY = height / 2;

    this.backdrop = this.scene.add.rectangle(centerX, centerY, width, height, 0x000000, 0.4).setDepth(this.depth - 1);
    this.backdrop.setAlpha(0).setInteractive();

    const bg = this.scene.add.rectangle(0, 0, popupW, popupH, 0x36d616, 1).setDepth(this.depth);
    const closeBtn = this.scene.add.circle(popupW / 2 - 18, -popupH / 2 + 18, 14, 0x00ffff, 1).setDepth(this.depth + 1);
    const closeLabel = this.scene.add
      .text(closeBtn.x, closeBtn.y, "X", { fontSize: "16px", fontFamily: "Arial", color: "#ff0000" })
      .setOrigin(0.5)
      .setDepth(this.depth + 2);

    closeBtn.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.hide());
    closeLabel.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.hide());

    const { gameId, ...btnConfig } = config;
    const buttons = Object.keys(btnConfig)
      .sort()
      .map((key) => btnConfig[key as keyof typeof btnConfig])
      .filter(Boolean) as PopupButton[];
    const btnGap = 14;
    const btnH = 44;
    const btnW = popupW - 40;
    const totalBtnHeight = buttons.length * btnH + (buttons.length - 1) * btnGap;
    const startY = -totalBtnHeight / 2 + btnH / 2;
    const btnObjs: Phaser.GameObjects.GameObject[] = [];

    buttons.forEach((btn, idx) => {
      const y = startY + idx * (btnH + btnGap);
      const rect = this.scene.add.rectangle(0, y, btnW, btnH, 0x11a9ff, 0.1).setDepth(this.depth + 1);
      rect.setStrokeStyle(2, 0x0000ff, 1);
      const label = this.scene.add
        .text(0, y, btn.label, { fontSize: "18px", fontFamily: "Arial", color: "#ff0000" })
        .setOrigin(0.5)
        .setDepth(this.depth + 2);
      const handleClick = async () => {
        await this.hide();
        await Promise.resolve(btn.onClick?.());
      };
      rect.setInteractive({ useHandCursor: true }).on("pointerdown", handleClick);
      label.setInteractive({ useHandCursor: true }).on("pointerdown", handleClick);
      btnObjs.push(rect, label);
    });

    // Game ID footer
    if (gameId) {
      const footerY = popupH / 2 - 22;
      const footerBg = this.scene.add.rectangle(0, footerY, popupW - 24, 34, 0x000000, 0.1).setDepth(this.depth + 1);
      footerBg.setStrokeStyle(1, 0x00ff00, 0.8);
      const footerText = this.scene.add
        .text(0, footerY, `Game ID: ${gameId}`, { fontSize: "14px", fontFamily: "Arial", color: "#ffffff" })
        .setOrigin(0.5)
        .setDepth(this.depth + 2);
      footerBg.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.copyToClipboard(gameId));
      footerText.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.copyToClipboard(gameId));
      btnObjs.push(footerBg, footerText);
    }

    this.container = this.scene.add.container(centerX, centerY, [bg, closeBtn, closeLabel, ...btnObjs]).setDepth(this.depth);
    this.container.setAlpha(0);

    this.scene.tweens.add({
      targets: [this.backdrop, this.container],
      alpha: 1,
      duration: this.tweenDuration,
      ease: "Quad.easeOut",
    });
  }

  async hide(): Promise<void> {
    if (!this.container && !this.backdrop) return;
    await new Promise<void>((resolve) => {
      this.scene.tweens.add({
        targets: [this.backdrop, this.container].filter(Boolean) as any[],
        alpha: 0,
        duration: this.tweenDuration,
        ease: "Quad.easeIn",
        onComplete: () => {
          this.container?.destroy();
          this.backdrop?.destroy();
          this.container = undefined;
          this.backdrop = undefined;
          resolve();
        },
      });
    });
  }

  private copyToClipboard(text: string) {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => this.execFallbackCopy(text));
      return;
    }
    this.execFallbackCopy(text);
  }

  private execFallbackCopy(text: string) {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    } catch {
      // no-op
    }
  }
}
