import Phaser from "phaser";
import { BASE_W } from "../../config/gameLayout";
import { Offset, Palette, RoundedRectConfig, toColor } from "./types";

// Shared frame styling used by BoardUI.
export const FRAME_STYLE: Pick<RoundedRectConfig, "radius" | "fillAlpha" | "strokeColor" | "strokeAlpha" | "strokeWidth"> = {
  radius: 18,
  fillAlpha: 0.98,
  strokeColor: "#ffffff",
  strokeAlpha: 0,
  strokeWidth: 0,
};

// Shared drawing helpers for UI shapes.
export class DrawHelpers {
  constructor(private scene: Phaser.Scene) {}

  drawRoundedRect(config: RoundedRectConfig) {
    const {
      x,
      y,
      width,
      height,
      radius,
      fillColor,
      fillAlpha = 1,
      strokeColor,
      strokeAlpha = 1,
      strokeWidth = 0,
    } = config;
    const g = this.scene.add.graphics({ x: x - width / 2, y: y - height / 2 });
    g.fillStyle(toColor(fillColor), fillAlpha);
    g.fillRoundedRect(0, 0, width, height, radius);
    if (strokeWidth > 0 && strokeColor !== undefined) {
      g.lineStyle(strokeWidth, toColor(strokeColor), strokeAlpha);
      g.strokeRoundedRect(0, 0, width, height, radius);
    }
    return g;
  }

  drawRoundedRectOrigin(config: RoundedRectConfig) {
    const {
      x,
      y,
      width,
      height,
      radius,
      fillColor,
      fillAlpha = 1,
      strokeColor,
      strokeAlpha = 1,
      strokeWidth = 0,
    } = config;
    const g = this.scene.add.graphics({ x: x, y: y});
    g.fillStyle(toColor(fillColor), fillAlpha);
    g.fillRoundedRect(0, 0, width, height, radius);
    if (strokeWidth > 0 && strokeColor !== undefined) {
      g.lineStyle(strokeWidth, toColor(strokeColor), strokeAlpha);
      g.strokeRoundedRect(0, 0, width, height, radius);
    }
    return g;
  }

  toColor(value: number | string) {
    return toColor(value);
  }
}

type HeaderLayout = { height: number; padding: number; avatar: number };
type HeaderState = { handCount: number; name: string };

export class HeaderHandler {
  private layout: HeaderLayout = { height: 60, padding: 10, avatar: 45 };
  private state: HeaderState = { handCount: 8, name: "Opponent" };
  private depth = 1000;
  private ctaButton?: Phaser.GameObjects.Rectangle;
  private ctaLabel?: Phaser.GameObjects.Text;
  private onCta?: () => void;
  private ctaVisible = true;
  private statusLabel?: Phaser.GameObjects.Text;
  private headerX = { left: 0, right: 0, centerY: 0 };
  private avatarHit?: Phaser.GameObjects.Rectangle;
  private onAvatar?: () => void;

  constructor(private scene: Phaser.Scene, private palette: Palette, private drawHelpers: DrawHelpers, private framePadding: number) {}

  draw(offset: Offset) {
    const { height, padding, avatar } = this.layout;
    const { handCount, name } = this.state;

    const containerW = BASE_W;
    const containerX = BASE_W / 2 + offset.x;
    // Pin header to the very top of the play area (no vertical padding).
    const containerY = height / 2 + offset.y;
    const containerLeft = containerX - containerW / 2;
    const containerRight = containerX + containerW / 2;
    const containerTop = containerY - height / 2;
    const containerBottom = containerY + height / 2;
    this.headerX = { left: containerLeft, right: containerRight, centerY: containerY };

    this.drawHelpers.drawRoundedRect({
      x: containerX,
      y: containerY,
      width: containerW,
      height,
      radius: 0,
      fillColor: "#153ae0",
      fillAlpha: 0.5,
      strokeColor: this.palette.ink,
      strokeAlpha: 0,
      strokeWidth: 0,
    }).setDepth(this.depth);

    // Avatar block
    const avatarX = containerLeft + padding + avatar / 2 + (BASE_W-400)/2;
    const avatarY = containerY;
    this.drawHelpers.drawRoundedRect({
      x: avatarX,
      y: avatarY,
      width: avatar,
      height: avatar,
      radius: 6,
      fillColor: "#ffffff",
      fillAlpha: 1,
      strokeColor: this.palette.ink,
      strokeAlpha: 1,
      strokeWidth: 2,
    }).setDepth(this.depth);
    this.drawAvatarHit(avatarX, avatarY, avatar, avatar);

    // Name next to avatar (left side)
    const nameX = avatarX + avatar / 2 + padding;
    this.scene.add
      .text(nameX, containerTop + padding, name, {
        fontSize: "20px",
        fontFamily: "Arial",
        color:"#ffffff",
      })
      .setOrigin(0, 0)
      .setDepth(this.depth);

    // Hand count below name
    const handTextX = nameX;
    const handY = containerTop + padding +25;
    this.scene.add
      .text(handTextX, handY, `Hand Num:  ${handCount}`, {
        fontSize: "16px",
        fontFamily: "Arial",
        color:"#ffffff",
      })
      .setOrigin(0, 0)
      .setDepth(this.depth);

    this.drawStartButton(containerRight - padding - 35, containerY, 80, height - padding * 2);
    this.drawStatus(this.computeStatusX(), containerY);
  }

  updateState(state: Partial<HeaderState>) {
    this.state = { ...this.state, ...state };
  }

  setCtaHandler(handler: () => void) {
    this.onCta = handler;
  }

  setAvatarHandler(handler: () => void) {
    this.onAvatar = handler;
    this.avatarHit?.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.onAvatar?.());
  }

  setCtaVisible(visible: boolean) {
    this.ctaVisible = visible;
    this.ctaButton?.setVisible(visible);
    this.ctaLabel?.setVisible(visible);
    // Recompute status position when button visibility changes.
    if (this.statusLabel) {
      this.statusLabel.setPosition(this.computeStatusX(), this.headerX.centerY);
    }
  }

  setStatusText(text: string) {
    if (!this.statusLabel) return;
    this.statusLabel.setText(text);
  }

  private drawStartButton(x: number, y: number, w: number, h: number) {
    this.ctaButton?.destroy();
    this.ctaLabel?.destroy();
    this.ctaButton = this.scene.add.rectangle(x, y, w, h, 0xffffff, 0.15).setStrokeStyle(1.5, 0xffffff, 0.8).setDepth(this.depth);
    this.ctaLabel = this.scene.add
      .text(x, y, "Start", {
        fontSize: "14px",
        fontFamily: "Arial",
        color: "#ffffff",
      })
      .setOrigin(0.5)
      .setDepth(this.depth + 1);

    this.ctaButton.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.onCta?.());
    this.setCtaVisible(this.ctaVisible);
  }

  private drawStatus(x: number, y: number) {
    this.statusLabel?.destroy();
    this.statusLabel = this.scene.add
      .text(x, y, "Status: idle", {
        fontSize: "14px",
        fontFamily: "Arial",
        color: "#ffffff",
      })
      .setOrigin(0.5)
      .setDepth(this.depth + 1);
  }

  private computeStatusX() {
    // If CTA is visible, keep status slightly left of the button; otherwise align nearer the right edge.
    const padding = this.layout.padding;
    const offsetWithButton = 160;
    return this.ctaVisible ? this.headerX.right - padding - offsetWithButton : this.headerX.right - padding - 60;
  }

  private drawAvatarHit(x: number, y: number, w: number, h: number) {
    this.avatarHit?.destroy();
    this.avatarHit = this.scene.add.rectangle(x, y, w, h, 0x000000, 0).setDepth(this.depth + 2);
    if (this.onAvatar) {
      this.avatarHit.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.onAvatar?.());
    }
  }
}
