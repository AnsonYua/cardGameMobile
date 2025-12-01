import Phaser from "phaser";
import { BASE_W } from "../../config/gameLayout";
import { Offset, Palette, RoundedRectConfig, toColor } from "./types";

// Shared frame styling used by BoardUI.
export const FRAME_STYLE: Pick<RoundedRectConfig, "radius" | "fillAlpha" | "strokeColor" | "strokeAlpha" | "strokeWidth"> = {
  radius: 18,
  fillAlpha: 0.98,
  strokeColor: 0x000000,
  strokeAlpha: 0.4,
  strokeWidth: 2,
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

    this.drawHelpers.drawRoundedRect({
      x: containerX,
      y: containerY,
      width: containerW,
      height,
      radius: 0,
      fillColor: "#ffffff",
      fillAlpha: 1,
      strokeColor: this.palette.ink,
      strokeAlpha: 0.7,
      strokeWidth: 2,
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

    // Name next to avatar (left side)
    const nameX = avatarX + avatar / 2 + padding;
    this.scene.add
      .text(nameX, containerTop + padding, name, {
        fontSize: "20px",
        fontFamily: "Arial",
        color: this.palette.ink,
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
        color: this.palette.ink,
      })
      .setOrigin(0, 0)
      .setDepth(this.depth);

  }

  updateState(state: Partial<HeaderState>) {
    this.state = { ...this.state, ...state };
  }
}
