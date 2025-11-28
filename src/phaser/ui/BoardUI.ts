import Phaser from "phaser";
import { BASE_H, BASE_W } from "../../config/gameLayout";

type Offset = { x: number; y: number };
type HeaderLayout = { height: number; padding: number; avatar: number; orbRadius: number; orbGap: number; orbMax: number };
type HeaderState = { handCount: number; orbCount: number; scoreCurrent: number; scoreMax: number; name: string };
type Palette = { ink: string; slot: string; accent: string; text: string; bg: string };

export class BoardUI {
  private layout: HeaderLayout = { height: 70, padding: 5, avatar: 56, orbRadius: 8, orbGap: 4, orbMax: 12 };
  private state: HeaderState = { handCount: 8, orbCount: 3, scoreCurrent: 12, scoreMax: 10, name: "Opponent" };
  private frameRect = { x: BASE_W / 2, y: BASE_H / 2, w: BASE_W - 12, h: BASE_H - 12 };
  private field = {
    slot: 70,
    gap: 14,
    cols: 3,
    rows: 2,
    deckW: 60,
    deckH: 90,
    towerWidth: 64,
    baseSize: 70,
    barCount: 5,
    barGap: -40, // stronger overlap
    towerGap: 8,
    columnGap: 2,
  };
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
    { color: 0xf28d6c, cost: "1" },
    { color: 0x6e6f8a, cost: "3" },
  ];

  constructor(private scene: Phaser.Scene, private palette: Palette) {}

  drawFrame(offset: Offset) {
    this.drawRoundedRect({
      x: this.frameRect.x + offset.x,
      y: this.frameRect.y + offset.y,
      width: this.frameRect.w,
      height: this.frameRect.h,
      radius: 18,
      fillColor: this.palette.bg,
      fillAlpha: 0.98,
      strokeColor: 0x000000,
      strokeAlpha: 0.4,
      strokeWidth: 2,
    });
  }

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
    const centerX = BASE_W / 2 + offset.x;
    const topY = offset.y + 170;
    const bottomY = offset.y + BASE_H - 380;
    this.drawFieldSide(centerX, topY, true);
    this.drawFieldSide(centerX, bottomY, false);
  }

  drawHand(offset: Offset) {
    const cardW = 60;
    const cardH = 90;
    const gap = 8;
    const perRow = 6; // show 6 per row (total 12 across 2 rows)
    const rows = 2;
    const bottomPadding = 24;
    const startY = BASE_H - bottomPadding - cardH / 2 - (rows - 1) * (cardH + gap) + offset.y;
    const labelY = startY - 50;

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

  private drawFieldSide(centerX: number, originY: number, isTop: boolean) {
    const { slot, gap, cols, rows, deckW, deckH, towerWidth, baseSize, barCount, barGap, towerGap, columnGap } = this.field;
    const gridTotalW = cols * slot + (cols - 1) * gap;
    const gridStartX = centerX - gridTotalW / 2;
    const rowY = (rowIndex: number) => originY + rowIndex * (slot + gap);

    // grid slots (3x2)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = gridStartX + c * (slot + gap) + slot / 2;
        const y = rowY(r);
        this.drawRoundedRect({
          x,
          y,
          width: slot,
          height: slot,
          radius: 6,
          fillColor: "#ffffff",
          fillAlpha: 1,
          strokeColor: this.palette.ink,
          strokeAlpha: 0.8,
          strokeWidth: 2,
        });
        this.scene.add.text(x, y, "slot", { fontSize: "14px", fontFamily: "Arial", color: this.palette.ink }).setOrigin(0.5);
      }
    }

    // positions for tower vs deck/trash; swap left/right per side
    const leftX = gridStartX - slot / 2 - columnGap;
    const rightX = gridStartX + gridTotalW + slot / 2 + columnGap;

    // swap per side: opponent (top) gets tower on right, deck/trash on left; player (bottom) gets tower on left, deck/trash on right
    const towerX = isTop ? rightX : leftX;
    const pileX = isTop ? leftX : rightX;

    // deck + trash column (stacked)
    const pileGap = 12;
    const topPileLabel = isTop ? "trash" : "deck";
    const bottomPileLabel = isTop ? "deck" : "trash";
    const topPileY = originY - deckH / 2 - pileGap / 2;
    const bottomPileY = originY + deckH / 2 + pileGap / 2;
    this.drawPile(pileX, topPileY, deckW, deckH, topPileLabel);
    this.drawPile(pileX, bottomPileY, deckW, deckH, bottomPileLabel);

    // tower (base + shield bars)
    const shieldW = deckH; // rotated hand ratio
    const shieldH = deckW;
    const stackHeight = this.computeStackHeight(barCount, shieldH, barGap, towerGap, baseSize, isTop);
    const stackTop = originY - stackHeight / 2;
    this.drawShieldStack(towerX, stackTop, barCount, barGap, towerGap, baseSize, shieldW, shieldH, isTop);
  }

  private drawPile(x: number, y: number, w: number, h: number, label: string) {
    if (label === "deck") {
      this.drawHandStyleCard(x, y, w, h, 0xb8673f);
      this.scene.add
        .text(x, y, "deck", { fontSize: "14px", fontFamily: "Arial", color: "#0f1118" })
        .setOrigin(0.5);
    } else {
      this.drawCardBox(x, y, w, h, label);
    }
  }

  private drawShieldStack(
    x: number,
    stackTop: number,
    barCount: number,
    barGap: number,
    towerGap: number,
    baseSize: number,
    shieldW: number,
    shieldH: number,
    isTop: boolean
  ) {
    const totalBarsHeight = barCount * shieldH + (barCount - 1) * barGap;
    const baseOverlap = 20; // how much base overlaps the stack
    const barsTop = isTop
      ? stackTop // opponent shields start at top
      : stackTop + baseSize - baseOverlap + towerGap; // player shields below base
    const baseY = isTop
      ? barsTop + totalBarsHeight + towerGap - baseOverlap + baseSize / 2 // base below shields
      : stackTop + baseSize / 2 - baseOverlap / 2; // lift base upward to overlap shields

    // draw order: opponent -> shields then base (base in front); player -> shields bottom-up then base on top
    if (isTop) {
      for (let i = 0; i < barCount; i++) {
        const y = barsTop + shieldH / 2 + i * (shieldH + barGap);
        const label = i === Math.floor(barCount / 2) ? "shield*" : "";
        this.drawHandStyleCard(x, y, shieldW, shieldH, this.toColor("#b0b7c5"));
        if (label) {
          this.scene.add.text(x, y, label, { fontSize: "12px", fontFamily: "Arial", color: this.palette.ink }).setOrigin(0.5);
        }
      }
      this.drawHandStyleCard(x, baseY, baseSize, baseSize, this.toColor("#c9d5e0"));
      this.scene.add.text(x, baseY, "base", { fontSize: "14px", fontFamily: "Arial", color: this.palette.ink }).setOrigin(0.5);
    } else {
      for (let i = barCount - 1; i >= 0; i--) {
        const y = barsTop + shieldH / 2 + i * (shieldH + barGap);
        const label = i === Math.floor(barCount / 2) ? "shield*" : "";
        this.drawHandStyleCard(x, y, shieldW, shieldH, this.toColor("#b0b7c5"));
        if (label) {
          this.scene.add.text(x, y, label, { fontSize: "12px", fontFamily: "Arial", color: this.palette.ink }).setOrigin(0.5);
        }
      }
      this.drawHandStyleCard(x, baseY, baseSize, baseSize, this.toColor("#c9d5e0"));
      this.scene.add.text(x, baseY, "base", { fontSize: "14px", fontFamily: "Arial", color: this.palette.ink }).setOrigin(0.5);
    }
  }

  private computeStackHeight(barCount: number, shieldH: number, barGap: number, towerGap: number, baseSize: number, isTop: boolean) {
    const totalBarsHeight = barCount * shieldH + (barCount - 1) * barGap;
    const baseOverlap = 20;
    return isTop
      ? totalBarsHeight + towerGap - baseOverlap + baseSize // opponent: shields over base
      : baseSize - baseOverlap + towerGap + totalBarsHeight; // player: base over shields
  }

  private drawCardBox(x: number, y: number, w: number, h: number, label: string) {
    this.drawRoundedRect({
      x,
      y,
      width: w,
      height: h,
      radius: 8,
      fillColor: "#ffffff",
      fillAlpha: 1,
      strokeColor: this.palette.ink,
      strokeAlpha: 1,
      strokeWidth: 2,
    });
    if (label) {
      this.scene.add.text(x, y, label, { fontSize: "13px", fontFamily: "Arial", color: this.palette.ink }).setOrigin(0.5);
    }
  }

  private drawHandStyleCard(x: number, y: number, w: number, h: number, fill: number) {
    // outer
    this.drawRoundedRect({
      x,
      y,
      width: w,
      height: h,
      radius: 10,
      fillColor: fill,
      fillAlpha: 1,
      strokeColor: this.toColor("#5a463a"),
      strokeAlpha: 0.8,
      strokeWidth: 2,
    });
    // inner
    this.drawRoundedRect({
      x,
      y,
      width: w - 12,
      height: h - 18,
      radius: 8,
      fillColor: this.toColor("#d7a97d"),
      fillAlpha: 0.6,
      strokeColor: this.toColor("#9b6c4b"),
      strokeAlpha: 0.7,
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
