import Phaser from "phaser";
import { BASE_W } from "../../config/gameLayout";

type Offset = { x: number; y: number };
type HeaderLayout = { height: number; padding: number; avatar: number; orbRadius: number; orbGap: number; orbMax: number };
type HeaderState = { handCount: number; orbCount: number; scoreCurrent: number; scoreMax: number; name: string };
type Palette = { ink: string; slot: string; accent: string; text: string };

export class BoardUI {
  private layout: HeaderLayout = { height: 70, padding: 5, avatar: 56, orbRadius: 8, orbGap: 4, orbMax: 12 };
  private state: HeaderState = { handCount: 8, orbCount: 3, scoreCurrent: 12, scoreMax: 10, name: "Opponent" };
  private field = { cols: 4, rows: 3, slotW: 68, slotH: 90, gapX: 10, gapY: 12, top: 140 };
  private handCards: Array<{ color: number; cost?: string }> = [
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
  ];

  constructor(private scene: Phaser.Scene, private palette: Palette) {}

  drawHeader(offset: Offset) {
    const { height, padding, avatar, orbRadius, orbGap, orbMax } = this.layout;
    const { handCount, orbCount, scoreCurrent, scoreMax, name } = this.state;

    const containerX = BASE_W / 2 + offset.x;
    const containerY = 35;
    const containerW = BASE_W;

    this.drawRoundedRect({
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
    });

    // Avatar block
    const avatarX = containerX - containerW / 2 + padding + avatar / 2;
    const avatarY = containerY - height / 2 + padding + 2 + avatar / 2;
    this.drawRoundedRect({
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
    });

    this.scene.add
      .text(containerW - 5, containerY - 20, name, {
        fontSize: "20px",
        fontFamily: "Arial",
        color: this.palette.ink,
      })
      .setOrigin(1, 0.5);

    // Hand count text
    const textX = avatarX + avatar / 2 + 16 / 2;
    const handY = avatarY - avatar / 2 + 25;
    this.scene.add
      .text(textX, handY, `Hand Num:  ${handCount}`, {
        fontSize: "16px",
        fontFamily: "Arial",
        color: this.palette.ink,
      })
      .setOrigin(0, 0.5);

    // Orb row (max 12)
    const orbY = 55;
    const orbX = avatarX + avatar / 2 + 34 / 2;
    const visibleOrbs = Math.min(orbCount, orbMax);
    for (let i = 0; i < orbMax; i++) {
      const x = orbX + i * (orbRadius * 2 + orbGap);
      const circle = this.scene.add.circle(x, orbY, orbRadius, 0xffffff);
      circle.setStrokeStyle(2, this.toColor(this.palette.ink), 1);
      if (i < visibleOrbs) {
        circle.setFillStyle(this.toColor(this.palette.ink), 1);
      }
    }

    // Score text on the right
    const scoreX = containerX + containerW / 2 - padding;
    this.scene.add
      .text(scoreX, orbY, `${scoreCurrent}/${scoreMax}()`, { fontSize: "20px", fontFamily: "Arial", color: this.palette.ink })
      .setOrigin(1, 0.5);
  }

  drawField(offset: Offset) {
    const { cols, rows, slotW, slotH, gapX, gapY, top } = this.field;
    const startX = (BASE_W - cols * slotW - (cols - 1) * gapX) / 2 + offset.x;
    const topWithOffset = top + offset.y;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = startX + c * (slotW + gapX) + slotW / 2;
        const y = topWithOffset + r * (slotH + gapY) + slotH / 2;
        this.drawRoundedRect({
          x,
          y,
          width: slotW,
          height: slotH,
          radius: 10,
          fillColor: this.palette.slot,
          fillAlpha: 0.9,
          strokeColor: this.palette.accent,
          strokeAlpha: 0.15,
          strokeWidth: 2,
        });
      }
    }
  }

  drawFieldCards(offset: Offset) {
    const placed: Array<{ col: number; row: number; card: { color: number; glow?: boolean } }> = [
      { col: 1, row: 0, card: { color: 0x9d512c } },
      { col: 2, row: 0, card: { color: 0x5c9de4, glow: true } },
      { col: 0, row: 1, card: { color: 0x2b8cb0 } },
      { col: 1, row: 1, card: { color: 0x9d512c } },
      { col: 2, row: 1, card: { color: 0x5c9de4 } },
      { col: 3, row: 1, card: { color: 0xf2d27c } },
      { col: 1, row: 2, card: { color: 0x5c9de4 } },
    ];
    placed.forEach(({ col, row, card }) => this.drawCardAtField(offset, col, row, card));
  }

  drawHand(offset: Offset) {
    const labelY = 430 + offset.y;
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

    const cardW = 65;
    const cardH = 94;
    const gap = 8;
    const perRow = 5;
    const startY = labelY + 70;

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

  private drawCardAtField(offset: Offset, col: number, row: number, card: { color: number; glow?: boolean }) {
    const { cols, rows, slotW, slotH, gapX, gapY, top } = this.field;
    const startX = (BASE_W - cols * slotW - (cols - 1) * gapX) / 2 + offset.x;
    const topWithOffset = top + offset.y;
    const x = startX + col * (slotW + gapX) + slotW / 2;
    const y = topWithOffset + row * (slotH + gapY) + slotH / 2;

    const glow = card.glow ? this.scene.add.rectangle(x, y, slotW + 16, slotH + 16, 0x59c4ff, 0.3) : null;
    if (glow) glow.setOrigin(0.5).setStrokeStyle(2, 0x59c4ff, 0.8);

    this.drawRoundedRect({
      x,
      y,
      width: slotW,
      height: slotH,
      radius: 12,
      fillColor: card.color,
      fillAlpha: 1,
      strokeColor: 0xffffff,
      strokeAlpha: 0.5,
      strokeWidth: 2,
    });
  }

  private drawHandCard(x: number, y: number, w: number, h: number, card: { color: number; cost?: string }) {
    this.drawRoundedRect({
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

    if (card.cost !== undefined) {
      const cx = x - w / 2 + 10;
      const cy = y - h / 2 + 10;
      this.scene.add.circle(cx, cy, 10, 0x2a2d38).setStrokeStyle(1, 0xffffff, 0.8);
      this.scene.add.text(cx, cy, card.cost, { fontSize: "12px", fontFamily: "Arial", color: "#ffffff" }).setOrigin(0.5);
    }

    // simple inner rectangle to mimic art area
    this.drawRoundedRect({
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
  }

  private drawRoundedRect(config: {
    x: number;
    y: number;
    width: number;
    height: number;
    radius: number;
    fillColor: number | string;
    fillAlpha?: number;
    strokeColor?: number | string;
    strokeAlpha?: number;
    strokeWidth?: number;
  }) {
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
    g.fillStyle(this.toColor(fillColor), fillAlpha);
    g.fillRoundedRect(0, 0, width, height, radius);
    if (strokeWidth > 0 && strokeColor !== undefined) {
      g.lineStyle(strokeWidth, this.toColor(strokeColor), strokeAlpha);
      g.strokeRoundedRect(0, 0, width, height, radius);
    }
    return g;
  }

  private toColor(value: number | string) {
    return typeof value === "number" ? value : Phaser.Display.Color.HexStringToColor(value).color;
  }
}
