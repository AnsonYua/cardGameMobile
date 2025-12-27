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
type HeaderState = { handCount: number; name: string; opponentHand?: number | string };

export class HeaderHandler {
  private layout: HeaderLayout = { height: 60, padding: 10, avatar: 45 };
  private state: HeaderState = { handCount: 8, name: "Opponent", opponentHand: "-" };
  private depth = 1000;
  private statusLabel?: Phaser.GameObjects.Text;
  private avatarHit?: Phaser.GameObjects.Rectangle;
  private onAvatar?: () => void;
  private nameLabel?: Phaser.GameObjects.Text;
  private handLabel?: Phaser.GameObjects.Text;

  constructor(private scene: Phaser.Scene, private palette: Palette, private drawHelpers: DrawHelpers) {}

  draw(offset: Offset) {
    const { height, padding, avatar } = this.layout;
    const { handCount, name, opponentHand } = this.state;

    const containerW = BASE_W;
    const containerX = BASE_W / 2 + offset.x;
    // Pin header to the very top of the play area (no vertical padding).
    const containerY = height / 2 + offset.y;
    const containerLeft = containerX - containerW / 2;
    const containerRight = containerX + containerW / 2;
    const containerTop = containerY - height / 2;

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
    this.nameLabel?.destroy();
    this.nameLabel = this.scene.add
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
    const handLabel = opponentHand !== undefined ? opponentHand : handCount;
    const handDisplay = handLabel === null || handLabel === undefined || handLabel === "" ? "-" : `${handLabel}`;
    this.handLabel?.destroy();
    this.handLabel = this.scene.add
      .text(handTextX, handY, `Opponent Hand: ${handDisplay}`, {
        fontSize: "14px",
        fontFamily: "Arial",
        color:"#ffffff",
      })
      .setOrigin(0, 0)
      .setDepth(this.depth);

    this.drawStatus(containerRight -5 , containerY-15);
  }

  updateState(state: Partial<HeaderState>) {
    this.state = { ...this.state, ...state };
    this.syncLabelsFromState();
  }

  setAvatarHandler(handler: () => void) {
    this.onAvatar = handler;
    this.avatarHit?.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.onAvatar?.());
  }
  setStatusText(text: string) {
    if (!this.statusLabel) return;
    this.statusLabel.setText(text);
  }

  private drawStatus(x: number, y: number) {
    this.statusLabel?.destroy();
    this.statusLabel = this.scene.add
      .text(x, y, "Status: idle", {
        fontSize: "14px",
        fontFamily: "Arial",
        color: "#ffffff",
      })
      .setOrigin(1, 0.5) // Right-align so the text hugs the CTA/right edge consistently.
      .setDepth(this.depth + 1);
  }

  private drawAvatarHit(x: number, y: number, w: number, h: number) {
    this.avatarHit?.destroy();
    this.avatarHit = this.scene.add.rectangle(x, y, w, h, 0x000000, 0).setDepth(this.depth + 2);
    if (this.onAvatar) {
      this.avatarHit.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.onAvatar?.());
    }
  }

  private syncLabelsFromState() {
    if (this.nameLabel) {
      this.nameLabel.setText(this.state.name);
    }
    if (this.handLabel) {
      const handLabel = this.state.opponentHand !== undefined ? this.state.opponentHand : this.state.handCount;
      const handDisplay = handLabel === null || handLabel === undefined || handLabel === "" ? "-" : `${handLabel}`;
      this.handLabel.setText(`Opponent Hand: ${handDisplay}`);
    }
  }
}
