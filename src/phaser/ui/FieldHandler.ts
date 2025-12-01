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
  baseSize: { w: number; h: number };
  side: {
    opponent: {
      centerX: number;
      originY: number;
      towerOffsetX: number;
      towerOffsetY: number;
      baseCenterX: number;
      shieldCenterX: number;
      baseCenterY: number;
      shieldCenterY: number;
    };
    player: {
      centerX: number;
      originY: number;
      towerOffsetX: number;
      towerOffsetY: number;
      baseCenterX: number;
      shieldCenterX: number;
      baseCenterY: number;
      shieldCenterY: number;
    };
  };
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
    deckW: 50,
    deckH: (90 * 50) / 60,
    towerWidth: 64,
    baseSize: { w: 60, h: 80 },
    side: {
      opponent: {
        centerX: BASE_W / 2,
        originY: 170,
        towerOffsetX: 0,
        towerOffsetY: 0,
        baseCenterX: 15,
        shieldCenterX: 15,
        baseCenterY: 0,
        shieldCenterY: 0,
      },
      player: {
        centerX: BASE_W / 2,
        originY: 170 + 240,
        towerOffsetX: 0,
        towerOffsetY: 0,
        baseCenterX: -15,
        shieldCenterX: -15,
        baseCenterY: 10,
        shieldCenterY: 0,
      },
    },
    barCount: 5,
    barGap: -25,
    towerGap: -5,
    columnGap: 2,
  };

  // Keep header reference to anchor top-side stacks just below it.
  private headerHeight = 82;
  private headerGap = 8;

  constructor(private scene: Phaser.Scene, private palette: Palette, private drawHelpers: DrawHelpers) {}

  draw(offset: Offset) {
    this.drawFieldSide(this.field.side.opponent, offset, true);
    this.drawFieldSide(this.field.side.player, offset, false);
  }

  private drawFieldSide(sideConfig: FieldConfig["side"]["opponent"], offset: Offset, isTop: boolean) {
    const { slot, gap, cols, rows, deckW, deckH, towerWidth, baseSize, barCount, barGap, towerGap, columnGap } = this.field;
    const centerX = sideConfig.centerX + offset.x;
    const originY = sideConfig.originY + offset.y;
    const sideOffsets = sideConfig;
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
    const towerX = (isTop ? rightX : leftX) + sideOffsets.towerOffsetX;
    const opponentBaseCenterX =
      rightX + this.field.side.opponent.towerOffsetX + this.field.side.opponent.baseCenterX;
    const playerBaseCenterX = leftX + this.field.side.player.towerOffsetX + this.field.side.player.baseCenterX;
    const pileX = isTop ? playerBaseCenterX : opponentBaseCenterX;
    const shieldX = towerX + sideOffsets.shieldCenterX;
    const baseX = towerX + sideOffsets.baseCenterX;
    const shieldYOffset = sideOffsets.shieldCenterY;
    const baseYOffset = sideOffsets.baseCenterY;

    const pileGap = 12;
    const topPileLabel = isTop ? "trash" : "deck";
    const bottomPileLabel = isTop ? "deck" : "trash";
    const topPileY = originY - deckH / 2 - pileGap / 2;
    const bottomPileY = originY + deckH / 2 + pileGap / 2;
    this.drawPile(pileX, topPileY, deckW, deckH, topPileLabel);
    this.drawPile(pileX, bottomPileY, deckW, deckH, bottomPileLabel);

    const shieldW = deckH;
    const shieldH = deckW;
    const stackHeight = this.computeStackHeight(barCount, shieldH, barGap, towerGap, baseSize.h, isTop);
    const baseStackTop = isTop ? this.headerHeight + this.headerGap : originY - stackHeight / 2;
    const stackTop = baseStackTop + sideOffsets.towerOffsetY;
    this.drawShieldStack(
      shieldX,
      baseX,
      shieldYOffset,
      baseYOffset,
      stackTop,
      barCount,
      barGap,
      towerGap,
      baseSize,
      shieldW,
      shieldH,
      isTop
    );
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
    shieldX: number,
    baseX: number,
    shieldYOffset: number,
    baseYOffset: number,
    stackTop: number,
    barCount: number,
    barGap: number,
    towerGap: number,
    baseSize: { w: number; h: number },
    shieldW: number,
    shieldH: number,
    isTop: boolean
  ) {
    const totalBarsHeight = barCount * shieldH + (barCount - 1) * barGap;
    const baseOverlap = 20;
    const barsTop = isTop ? stackTop : stackTop + baseSize.h - baseOverlap + towerGap;
    const baseY = isTop
      ? barsTop + totalBarsHeight + towerGap - baseOverlap + baseSize.h / 2
      : stackTop + baseSize.h / 2 - baseOverlap / 2;
    const baseYWithOffset = baseY + baseYOffset;

    if (isTop) {
      for (let i = 0; i < barCount; i++) {
        const y = barsTop + shieldH / 2 + i * (shieldH + barGap) + shieldYOffset;
        this.drawHandStyleCard(shieldX, y, shieldW, shieldH, this.drawHelpers.toColor("#b0b7c5"));
      }
      this.drawHandStyleCard(baseX, baseYWithOffset, baseSize.w, baseSize.h, this.drawHelpers.toColor("#c9d5e0"));
      this.scene.add
        .text(baseX, baseYWithOffset, "base", { fontSize: "14px", fontFamily: "Arial", color: this.palette.ink })
        .setOrigin(0.5);
    } else {
      for (let i = barCount - 1; i >= 0; i--) {
        const y = barsTop + shieldH / 2 + i * (shieldH + barGap) + shieldYOffset;
        this.drawHandStyleCard(shieldX, y, shieldW, shieldH, this.drawHelpers.toColor("#b0b7c5"));
      }
      this.drawHandStyleCard(baseX, baseYWithOffset, baseSize.w, baseSize.h, this.drawHelpers.toColor("#c9d5e0"));
      this.scene.add
        .text(baseX, baseYWithOffset, "base", { fontSize: "14px", fontFamily: "Arial", color: this.palette.ink })
        .setOrigin(0.5);
    }
  }

  private computeStackHeight(barCount: number, shieldH: number, barGap: number, towerGap: number, baseHeight: number, isTop: boolean) {
    const totalBarsHeight = barCount * shieldH + (barCount - 1) * barGap;
    const baseOverlap = 20;
    return isTop ? totalBarsHeight + towerGap - baseOverlap + baseHeight : baseHeight - baseOverlap + towerGap + totalBarsHeight;
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
