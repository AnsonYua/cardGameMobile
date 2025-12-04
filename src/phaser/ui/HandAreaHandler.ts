import Phaser from "phaser";
import { BASE_H, BASE_W } from "../../config/gameLayout";
import { DrawHelpers } from "./HeaderHandler";
import { Offset, Palette } from "./types";

type HandCard = { color: number; cost?: string };

export class HandAreaHandler {
  private handCards: HandCard[] = [
    { color: 0x9d512c, cost: "0" },
    { color: 0x6db1ff, cost: "1" },
    { color: 0xf2cf7d, cost: "2" },
    { color: 0x3db77a, cost: "2" },
    { color: 0xf28d6c, cost: "2" },
    { color: 0x6e6f8a, cost: "0" },
    { color: 0x9d512c, cost: "2" },
    { color: 0xf2cf7d, cost: "0" },
    { color: 0x6db1ff, cost: "2" },
    { color: 0x3db77a, cost: "0" },
    { color: 0xf28d6c, cost: "1" },
    { color: 0x6e6f8a, cost: "3" },
  ];
  private lastOffset: Offset = { x: 0, y: 0 };
  private drawnObjects: Phaser.GameObjects.GameObject[] = [];

  constructor(private scene: Phaser.Scene, private palette: Palette, private drawHelpers: DrawHelpers) {}

  draw(offset: Offset) {
    this.lastOffset = offset;
    this.clear();

    const cardW = 60;
    const cardH = 90;
    const gap = 8;
    const perRow = 6;
    const rows = 2;
    const bottomPadding = 24;
    const startY = BASE_H - bottomPadding - cardH / 2 - (rows - 1) * (cardH + gap) + offset.y;
    //const labelY = startY - 50;
    /*
    this.scene
      .add.text(BASE_W / 2 + offset.x, labelY, "Hand", {
        fontSize: "20px",
        fontFamily: "Arial",
        color: this.palette.text,
        stroke: "#000000",
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setDepth(10);
    */

    for (let i = 0; i < this.handCards.length; i++) {
      const row = Math.floor(i / perRow);
      const col = i % perRow;
      const totalW = perRow * cardW + (perRow - 1) * gap;
      const startX = (BASE_W - totalW) / 2 + cardW / 2 + offset.x;
      const x = startX + col * (cardW + gap);
      const y = startY + row * (cardH + gap);
      this.drawHandCard(x, y, cardW, cardH, this.handCards[i]);
    }
  }

  setHand(cards: HandCard[]) {
    this.handCards = cards;
    this.draw(this.lastOffset);
  }

  setVisible(visible: boolean) {
    // Skip any objects that may have been destroyed; be defensive to avoid runtime errors.
    this.drawnObjects = this.drawnObjects.filter((obj: any) => obj && !obj.destroyed);
    this.drawnObjects.forEach((obj: any) => obj?.setVisible?.(visible));
  }

  private drawHandCard(x: number, y: number, w: number, h: number, card: HandCard) {
    const bg = this.drawHelpers.drawRoundedRect({
      x,
      y,
      width: w,
      height: h,
      radius: 10,
      fillColor: card.color,
      fillAlpha: 1,
      strokeColor: this.palette.accent,
      strokeAlpha: 0.5,
      strokeWidth: 2,
    });
    this.drawnObjects.push(bg);

    if (card.cost !== undefined) {
      const cx = x - w / 2 + 10;
      const cy = y - h / 2 + 10;
      const badge = this.scene.add.circle(cx, cy, 10, 0x2a2d38).setStrokeStyle(1, 0xffffff, 0.8);
      const costText = this.scene.add.text(cx, cy, card.cost, { fontSize: "12px", fontFamily: "Arial", color: "#ffffff" }).setOrigin(0.5);
      this.drawnObjects.push(badge, costText);
    }

    const inner = this.drawHelpers.drawRoundedRect({
      x,
      y,
      width: w - 14,
      height: h - 22,
      radius: 8,
      fillColor: 0x1a1d26,
      fillAlpha: 0.4,
      strokeColor: 0x000000,
      strokeAlpha: 0.3,
      strokeWidth: 1,
    });
    this.drawnObjects.push(inner);
  }

  private clear() {
    this.drawnObjects.forEach((obj) => obj.destroy());
    this.drawnObjects = [];
  }
}
