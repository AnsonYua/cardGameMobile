import Phaser from "phaser";
import { BASE_W } from "../../config/gameLayout";
import { Offset, Palette, RoundedRectConfig, toColor } from "./types";

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

type HeaderLayout = { height: number; padding: number; avatar: number; orbRadius: number; orbGap: number; orbMax: number };
type HeaderState = { handCount: number; orbCount: number; scoreCurrent: number; scoreMax: number; name: string };

export class HeaderHandler {
  private layout: HeaderLayout = { height: 82, padding: 12, avatar: 56, orbRadius: 8, orbGap: 4, orbMax: 12 };
  private state: HeaderState = { handCount: 8, orbCount: 3, scoreCurrent: 12, scoreMax: 10, name: "Opponent" };
  private depth = 1000;

  constructor(private scene: Phaser.Scene, private palette: Palette, private drawHelpers: DrawHelpers, private framePadding: number) {}

  draw(offset: Offset) {
    const { height, padding, avatar, orbRadius, orbGap, orbMax } = this.layout;
    const { handCount, orbCount, scoreCurrent, scoreMax, name } = this.state;

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
    const avatarX = containerLeft + padding + avatar / 2;
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

    this.scene.add
      .text(containerRight - padding, containerTop + padding, name, {
        fontSize: "20px",
        fontFamily: "Arial",
        color: this.palette.ink,
      })
      .setOrigin(1, 0)
      .setDepth(this.depth);

    // Hand count text
    const textX = avatarX + avatar / 2 + 10;
    const handY = avatarY;
    this.scene.add
      .text(textX, handY, `Hand Num:  ${handCount}`, {
        fontSize: "16px",
        fontFamily: "Arial",
        color: this.palette.ink,
      })
      .setOrigin(0, 0.5)
      .setDepth(this.depth);

    // Orb row (max 12)
    const orbY = containerBottom - padding - orbRadius;
    const orbX = textX+8;
    const visibleOrbs = Math.min(orbCount, orbMax);
    for (let i = 0; i < orbMax; i++) {
      const x = orbX + i * (orbRadius * 2 + orbGap);
      const circle = this.scene.add.circle(x, orbY, orbRadius, 0xffffff);
      circle.setStrokeStyle(2, this.drawHelpers.toColor(this.palette.ink), 1);
      if (i < visibleOrbs) {
        circle.setFillStyle(this.drawHelpers.toColor(this.palette.ink), 1);
      }
      circle.setDepth(this.depth);
    }

    // Score text on the right
    const scoreX = containerRight - 2;
    this.scene.add
      .text(scoreX, orbY, `${scoreCurrent}/${scoreMax} [+1]`, 
          { fontSize: "16px", 
            fontFamily: "Arial", 
            color: this.palette.ink ,
            align: "right" 
          })
      .setOrigin(1, 0.5)
      .setDepth(this.depth);
  }

  updateState(state: Partial<HeaderState>) {
    this.state = { ...this.state, ...state };
  }
}
