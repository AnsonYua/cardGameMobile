import Phaser from "phaser";
import { BASE_H, BASE_W } from "../../config/gameLayout";
import { DrawHelpers } from "./DrawHelpers";
import { Offset, Palette } from "./types";

type FieldConfig = {
  slot: number;
  gap: number;
  cols: number;
  rows: number;
  deckW: number;
  deckH: number;
  towerWidth: number;
  baseSize: number;
  barCount: number;
  barGap: number;
  towerGap: number;
  columnGap: number;
};

export class FieldHandler {
  private field: FieldConfig = {
    slot: 70,
    gap: 14,
    cols: 3,
    rows: 2,
    deckW: 60,
    deckH: 90,
    towerWidth: 64,
    baseSize: 70,
    barCount: 5,
    barGap: -40,
    towerGap: 8,
    columnGap: 2,
  };

  constructor(private scene: Phaser.Scene, private palette: Palette, private drawHelpers: DrawHelpers) {}

  draw(offset: Offset) {
    const centerX = BASE_W / 2 + offset.x;
    const topY = offset.y + 170;
    const bottomY = offset.y + BASE_H - 380;
    this.drawFieldSide(centerX, topY, true);
    this.drawFieldSide(centerX, bottomY, false);
  }

  private drawFieldSide(centerX: number, originY: number, isTop: boolean) {
    const { slot, gap, cols, rows, deckW, deckH, towerWidth, baseSize, barCount, barGap, towerGap, columnGap } = this.field;
    const gridTotalW = cols * slot + (cols - 1) * gap;
    const gridStartX = centerX - gridTotalW / 2;
    const rowY = (rowIndex: number) => originY + rowIndex * (slot + gap);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = gridStartX + c * (slot + gap) + slot / 2;
        const y = rowY(r);
        this.drawHelpers.drawRoundedRect({
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

    const leftX = gridStartX - slot / 2 - columnGap;
    const rightX = gridStartX + gridTotalW + slot / 2 + columnGap;
    const towerX = isTop ? rightX : leftX;
    const pileX = isTop ? leftX : rightX;

    const pileGap = 12;
    const topPileLabel = isTop ? "trash" : "deck";
    const bottomPileLabel = isTop ? "deck" : "trash";
    const topPileY = originY - deckH / 2 - pileGap / 2;
    const bottomPileY = originY + deckH / 2 + pileGap / 2;
    this.drawPile(pileX, topPileY, deckW, deckH, topPileLabel);
    this.drawPile(pileX, bottomPileY, deckW, deckH, bottomPileLabel);

    const shieldW = deckH;
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
    const baseOverlap = 20;
    const barsTop = isTop ? stackTop : stackTop + baseSize - baseOverlap + towerGap;
    const baseY = isTop ? barsTop + totalBarsHeight + towerGap - baseOverlap + baseSize / 2 : stackTop + baseSize / 2 - baseOverlap / 2;

    if (isTop) {
      for (let i = 0; i < barCount; i++) {
        const y = barsTop + shieldH / 2 + i * (shieldH + barGap);
        const label = i === Math.floor(barCount / 2) ? "shield*" : "";
        this.drawHandStyleCard(x, y, shieldW, shieldH, this.drawHelpers.toColor("#b0b7c5"));
        if (label) {
          this.scene.add.text(x, y, label, { fontSize: "12px", fontFamily: "Arial", color: this.palette.ink }).setOrigin(0.5);
        }
      }
      this.drawHandStyleCard(x, baseY, baseSize, baseSize, this.drawHelpers.toColor("#c9d5e0"));
      this.scene.add.text(x, baseY, "base", { fontSize: "14px", fontFamily: "Arial", color: this.palette.ink }).setOrigin(0.5);
    } else {
      for (let i = barCount - 1; i >= 0; i--) {
        const y = barsTop + shieldH / 2 + i * (shieldH + barGap);
        const label = i === Math.floor(barCount / 2) ? "shield*" : "";
        this.drawHandStyleCard(x, y, shieldW, shieldH, this.drawHelpers.toColor("#b0b7c5"));
        if (label) {
          this.scene.add.text(x, y, label, { fontSize: "12px", fontFamily: "Arial", color: this.palette.ink }).setOrigin(0.5);
        }
      }
      this.drawHandStyleCard(x, baseY, baseSize, baseSize, this.drawHelpers.toColor("#c9d5e0"));
      this.scene.add.text(x, baseY, "base", { fontSize: "14px", fontFamily: "Arial", color: this.palette.ink }).setOrigin(0.5);
    }
  }

  private computeStackHeight(barCount: number, shieldH: number, barGap: number, towerGap: number, baseSize: number, isTop: boolean) {
    const totalBarsHeight = barCount * shieldH + (barCount - 1) * barGap;
    const baseOverlap = 20;
    return isTop ? totalBarsHeight + towerGap - baseOverlap + baseSize : baseSize - baseOverlap + towerGap + totalBarsHeight;
  }

  private drawCardBox(x: number, y: number, w: number, h: number, label: string) {
    this.drawHelpers.drawRoundedRect({
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
    this.drawHelpers.drawRoundedRect({
      x,
      y,
      width: w,
      height: h,
      radius: 10,
      fillColor: fill,
      fillAlpha: 1,
      strokeColor: this.drawHelpers.toColor("#5a463a"),
      strokeAlpha: 0.8,
      strokeWidth: 2,
    });
    this.drawHelpers.drawRoundedRect({
      x,
      y,
      width: w - 12,
      height: h - 18,
      radius: 8,
      fillColor: this.drawHelpers.toColor("#d7a97d"),
      fillAlpha: 0.6,
      strokeColor: this.drawHelpers.toColor("#9b6c4b"),
      strokeAlpha: 0.7,
      strokeWidth: 2,
    });
  }
}
