import Phaser from "phaser";
import { BASE_H, BASE_W } from "../../config/gameLayout";
import { DrawHelpers } from "./HeaderHandler";
import { Offset, Palette } from "./types";
import { GameStatusHandler } from "./GameStatusHandler";

export type FieldConfig = {
  slot: number;
  gap: number;
  cols: number;
  rows: number;
  deckW: number;
  deckH: number;
  towerWidth: number;
  baseSize: { w: number; h: number };
  shieldSize: { w: number; h: number };
  energy: {
    count: number;
    perRow: number;
    rows: number;
    radius: number;
    gap: number;
    rowGap: number;
    offsetFromSlots: number;
    fillColor: string;
    emptyColor: string;
    offsetX: {
      opponent: number;
      player: number;
    };
    offsetY: {
      opponent: number;
      player: number;
    };
  };
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
      deckTrashOffsetY: number;
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
      deckTrashOffsetY: number;
    };
  };
  barCount: number;
  shieldGap: number;
  towerGap: number;
  columnGap: number;
};

export class FieldHandler {
  static readonly DEFAULT_CONFIG: FieldConfig = {
    slot: 90,
    gap: 5,
    cols: 3,
    rows: 2,
    deckW: 57,
    deckH: 80,
    towerWidth: 64,
    baseSize: { w: 60, h: 80 },
    shieldSize: { w: 60, h: 80 },
    energy: {
      count: 12,
      perRow: 12,
      rows: 1,
      radius: 6,
      gap: 4,
      rowGap: 8,
      offsetFromSlots: 16,
      fillColor: "#18c56c",
      emptyColor: "#d94d4d",
      offsetX: { opponent: 8, player: 8 },
      offsetY: { opponent: 0, player: 0 },
    },
    side: {
      opponent: {
        centerX: BASE_W / 2,
        originY: 155,
        towerOffsetX: 0,
        towerOffsetY: 0,
        baseCenterX: 0,
        shieldCenterX: 0,
        baseCenterY: 0,
        shieldCenterY: 0,
        deckTrashOffsetY: 20,
      },
      player: {
        centerX: BASE_W / 2,
        originY: 155 + 195,
        towerOffsetX: 0,
        towerOffsetY: 60,
        baseCenterX: 0,
        shieldCenterX: 0,
        baseCenterY: 10,
        shieldCenterY: 0,
        deckTrashOffsetY: 60,
      },
  },
    barCount: 6,
    shieldGap: -65,
    towerGap: -5,
    columnGap: 2,
  };

  // Keep header reference to anchor top-side stacks just below it.
  private headerHeight = 82;
  private headerGap = 8;

  private field: FieldConfig;
  private gameStatus: GameStatusHandler;

  constructor(private scene: Phaser.Scene, private palette: Palette, private drawHelpers: DrawHelpers) {
    this.field = JSON.parse(JSON.stringify(FieldHandler.DEFAULT_CONFIG));
    this.gameStatus = new GameStatusHandler(scene, palette);
  }

  draw(offset: Offset) {
    this.drawFieldSide(this.field.side.opponent, offset, true);
    this.drawFieldSide(this.field.side.player, offset, false);
  }

  private drawFieldSide(sideConfig: FieldConfig["side"]["opponent"], offset: Offset, isTop: boolean) {
    const { slot, gap, cols, rows, deckW, deckH, towerWidth, baseSize, barCount, shieldGap, towerGap, columnGap, energy } = this.field;
    const { shieldSize } = this.field;
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
        // Overlay rect on top of slot to indicate a stack area.
        this.drawHelpers.drawRoundedRect({
          x,
          y,
          width: 70,
          height: 80,
          radius: 4,
          fillColor: "#f5f5f5",
          fillAlpha: 0.35,
          strokeColor: this.palette.ink,
          strokeAlpha: 0.6,
          strokeWidth: 1,
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
    const pileYOffset = sideOffsets.deckTrashOffsetY;
    const shieldX = towerX + sideOffsets.shieldCenterX;
    const baseX = towerX + sideOffsets.baseCenterX;
    const shieldYOffset = sideOffsets.shieldCenterY;
    const baseYOffset = sideOffsets.baseCenterY;

    const pileGap = 12;
    const topPileLabel = isTop ? "trash" : "deck";
    const bottomPileLabel = isTop ? "deck" : "trash";
    const topPileY = originY - deckH / 2 - pileGap / 2 + pileYOffset;
    const bottomPileY = originY + deckH / 2 + pileGap / 2 + pileYOffset;
    this.drawPile(pileX, topPileY, deckW, deckH, topPileLabel, isTop ? "opponent" : "player");
    this.drawPile(pileX, bottomPileY, deckW, deckH, bottomPileLabel, isTop ? "opponent" : "player");

    const shieldW = shieldSize.w;
    const shieldH = shieldSize.h;
    const stackHeight = this.computeStackHeight(barCount, shieldH, shieldGap, towerGap, baseSize.h, isTop);
    const baseStackTop = isTop ? this.headerHeight + this.headerGap : originY - stackHeight / 2;
    const stackTop = baseStackTop + sideOffsets.towerOffsetY;
    this.drawShieldStack(
      shieldX,
      baseX,
      shieldYOffset,
      baseYOffset,
      stackTop,
      barCount,
      shieldGap,
      towerGap,
      baseSize,
      shieldW,
      shieldH,
      isTop
    );

    // Energy bar: opponent above slots, player below slots.
    const energyYOffset = isTop ? energy.offsetY.opponent : energy.offsetY.player;
    const energyY =
      (isTop
        ? originY - slot / 2 - energy.offsetFromSlots
        : originY + (rows - 1) * (slot + gap) + slot / 2 + energy.offsetFromSlots) + energyYOffset;
    const energyX = centerX + (isTop ? energy.offsetX.opponent : energy.offsetX.player);
    this.drawEnergyBar(energyX, energyY, energy, gridTotalW, isTop);
    this.gameStatus.draw(energyX, energyY, gridTotalW, isTop, {
      shield: this.field.shieldCount,
      active: 0,
      rested: 0,
      extra: 0,
    });
  }

  private drawPile(x: number, y: number, w: number, h: number, label: string, owner: "opponent" | "player") {
    if (label === "deck") {
      if (this.scene.textures.exists("deckBack")) {
        this.scene.add.image(x, y, "deckBack").setDisplaySize(w, h).setOrigin(0.5).setDepth(10).setName(`deck-pile-${owner}`);
      } else {
        const deckShape = this.drawHandStyleCard(x, y, w, h, 0xb8673f);
        deckShape?.setName(`deck-pile-${owner}`);
        this.scene
          .add.text(x, y, "deck", { fontSize: "14px", fontFamily: "Arial", color: "#0f1118" })
          .setOrigin(0.5)
          .setName(`deck-pile-text-${owner}`);
      }
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
    shieldGap: number,
    towerGap: number,
    baseSize: { w: number; h: number },
    shieldW: number,
    shieldH: number,
    isTop: boolean
  ) {
    const totalBarsHeight = barCount * shieldH + (barCount - 1) * shieldGap;
    const baseOverlap = 20;
    const barsTop = isTop ? stackTop : stackTop + baseSize.h - baseOverlap + towerGap;
    const baseY = isTop
      ? barsTop + totalBarsHeight + towerGap - baseOverlap + baseSize.h / 2
      : stackTop + baseSize.h / 2 - baseOverlap / 2;
    const baseYWithOffset = baseY + baseYOffset;

    if (isTop) {
      for (let i = 0; i < barCount; i++) {
        const y = barsTop + shieldH / 2 + i * (shieldH + shieldGap) + shieldYOffset;
        this.drawShieldCard(shieldX, y, shieldW, shieldH);
      }
      this.drawHandStyleCard(baseX, baseYWithOffset, baseSize.w, baseSize.h, this.drawHelpers.toColor("#c9d5e0"));
      this.scene.add
        .text(baseX, baseYWithOffset, "base", { fontSize: "14px", fontFamily: "Arial", color: this.palette.ink })
        .setOrigin(0.5);
    } else {
      for (let i = barCount - 1; i >= 0; i--) {
        const y = barsTop + shieldH / 2 + i * (shieldH + shieldGap) + shieldYOffset;
        this.drawShieldCard(shieldX, y, shieldW, shieldH);
      }
      this.drawHandStyleCard(baseX, baseYWithOffset, baseSize.w, baseSize.h, this.drawHelpers.toColor("#c9d5e0"));
      this.scene.add
        .text(baseX, baseYWithOffset, "base", { fontSize: "14px", fontFamily: "Arial", color: this.palette.ink })
        .setOrigin(0.5);
    }
  }

  private computeStackHeight(barCount: number, shieldH: number, shieldGap: number, towerGap: number, baseHeight: number, isTop: boolean) {
    const totalBarsHeight = barCount * shieldH + (barCount - 1) * shieldGap;
    const baseOverlap = 20;
    return isTop ? totalBarsHeight + towerGap - baseOverlap + baseHeight : baseHeight - baseOverlap + towerGap + totalBarsHeight;
  }

  private drawEnergyBar(centerX: number, baseY: number, cfg: FieldConfig["energy"], barWidth: number, isTop: boolean) {
    const totalWidth = cfg.perRow * cfg.radius * 2 + (cfg.perRow - 1) * cfg.gap;
    // Opponent: align to right edge and draw right-to-left. Player: align to left edge.
    const startX = isTop ? centerX + barWidth / 2 - totalWidth : centerX - barWidth / 2;
    let drawn = 0;
    for (let row = 0; row < cfg.rows; row++) {
      const y = baseY + row * (cfg.radius * 2 + cfg.rowGap);
      for (let i = 0; i < cfg.perRow && drawn < cfg.count; i++) {
        const index = isTop ? cfg.perRow - 1 - i : i;
        const x = startX + index * (cfg.radius * 2 + cfg.gap);
        const filled = drawn < cfg.count / 2;
        const circle = this.scene.add.circle(x, y, cfg.radius);
        circle.setStrokeStyle(2, this.drawHelpers.toColor(cfg.emptyColor), 1);
        if (filled) {
          circle.setFillStyle(this.drawHelpers.toColor(cfg.fillColor), 1);
        }
        drawn++;
      }
    }
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
    const outer = this.drawHelpers.drawRoundedRect({
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
    return outer;
  }

  private drawShieldCard(x: number, y: number, w: number, h: number) {
    if (this.scene.textures.exists("deckBack")) {
      this.scene.add.image(x, y, "deckBack").setDisplaySize(w, h).setOrigin(0.5).setAngle(90);
    } else {
      this.drawHandStyleCard(x, y, w, h, this.drawHelpers.toColor("#b0b7c5"));
    }
  }
}
