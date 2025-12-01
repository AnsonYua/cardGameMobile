import Phaser from "phaser";
import { BASE_H, BASE_W } from "../../config/gameLayout";
import { DrawHelpers } from "./HeaderHandler";
import { Palette } from "./types";

export class ActionBarHandler {
  private barHeight = 40;
  private barPadding = 16;
  private buttons = ["Action 1", "Action 2", "Action 3", "Action 4", "Action 5"];

  // These mirror HandAreaHandler layout so the bar can sit just above the hand.
  private handLayout = { cardH: 90, gap: 8, rows: 2, bottomPadding: 24 };

  constructor(private scene: Phaser.Scene, private palette: Palette, private drawHelpers: DrawHelpers) {}

  draw(offset: { x: number; y: number }) {
    const barWidth = BASE_W - this.barPadding * 2;

    // Compute hand top using HandAreaHandler's layout to avoid overlap.
    const { cardH, gap, rows, bottomPadding } = this.handLayout;
    const totalHandHeight = rows * cardH + (rows - 1) * gap;
    const handTop = BASE_H - bottomPadding - totalHandHeight + offset.y;

    const barY = handTop - this.barHeight / 2 - 12; // small gap above hand
    const barX = BASE_W / 2 + offset.x;

    this.drawHelpers.drawRoundedRect({
      x: barX,
      y: barY,
      width: barWidth,
      height: this.barHeight,
      radius: 6,
      fillColor: "#3f2bd8",
      fillAlpha: 1,
      strokeColor: 0x000000,
      strokeAlpha: 0.4,
      strokeWidth: 2,
    });

    const btnCount = this.buttons.length;
    const btnGap = 12;
    const btnWidth = (barWidth - (btnCount - 1) * btnGap) / btnCount;
    const btnHeight = this.barHeight - 12;
    const startX = barX - barWidth / 2 + btnWidth / 2;
    for (let i = 0; i < btnCount; i++) {
      const x = startX + i * (btnWidth + btnGap);
      const y = barY;
      this.drawHelpers.drawRoundedRect({
        x,
        y,
        width: btnWidth,
        height: btnHeight,
        radius: 6,
        fillColor: "#5e48f0",
        fillAlpha: 1,
        strokeColor: 0xffffff,
        strokeAlpha: 0.7,
        strokeWidth: 2,
      });
      this.scene.add
        .text(x, y, this.buttons[i], {
          fontSize: "14px",
          fontFamily: "Arial",
          color: "#ffffff",
        })
        .setOrigin(0.5);
    }
  }
}
