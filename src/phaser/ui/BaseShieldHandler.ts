import Phaser from "phaser";
import { DrawHelpers } from "./HeaderHandler";
import { Palette } from "./types";

type BaseSize = { w: number; h: number };

type StackParams = {
  towerX: number;
  originY: number;
  isTop: boolean;
  offsets: {
    shieldCenterX: number;
    baseCenterX: number;
    shieldCenterY: number;
    baseCenterY: number;
    towerOffsetY: number;
  };
  headerHeight: number;
  headerGap: number;
};

type BaseShieldConfig = {
  baseSize: BaseSize;
  shieldSize: BaseSize;
  shieldCount: number;
  shieldGap: number;
  towerGap: number;
};

export class BaseShieldHandler {
  private config: BaseShieldConfig = {
    baseSize: { w: 60, h: 80 },
    shieldSize: { w: 60, h: 80 },
    shieldCount: 6,
    shieldGap: -65,
    towerGap: -5,
  };

  constructor(private scene: Phaser.Scene, private palette: Palette, private drawHelpers: DrawHelpers) {}

  setConfig(cfg: Partial<BaseShieldConfig>) {
    this.config = { ...this.config, ...cfg };
  }

  getShieldCount() {
    return this.config.shieldCount;
  }

  private computeStackHeight(shieldCount: number, shieldH: number, shieldGap: number, towerGap: number, baseHeight: number, isTop: boolean) {
    const totalBarsHeight = shieldCount * shieldH + (shieldCount - 1) * shieldGap;
    const baseOverlap = 20;
    return isTop ? totalBarsHeight + towerGap - baseOverlap + baseHeight : baseHeight - baseOverlap + towerGap + totalBarsHeight;
  }

  drawStack(params: StackParams) {
    const { towerX, originY, isTop, offsets, headerHeight, headerGap } = params;
    const { baseSize, shieldSize, shieldCount, shieldGap, towerGap } = this.config;
    const shieldX = towerX + offsets.shieldCenterX;
    const baseX = towerX + offsets.baseCenterX;
    const shieldW = shieldSize.w;
    const shieldH = shieldSize.h;
    const stackHeight = this.computeStackHeight(shieldCount, shieldH, shieldGap, towerGap, baseSize.h, isTop);
    const baseStackTop = isTop ? headerHeight + headerGap : originY - stackHeight / 2;
    const stackTop = baseStackTop + offsets.towerOffsetY;
    const shieldYOffset = offsets.shieldCenterY;
    const baseYOffset = offsets.baseCenterY;
    const totalBarsHeight = shieldCount * shieldH + (shieldCount - 1) * shieldGap;
    const baseOverlap = 20;
    const barsTop = isTop ? stackTop : stackTop + baseSize.h - baseOverlap + towerGap;
    const baseY = isTop
      ? barsTop + totalBarsHeight + towerGap - baseOverlap + baseSize.h / 2
      : stackTop + baseSize.h / 2 - baseOverlap / 2;
    const baseYWithOffset = baseY + baseYOffset;

    if (isTop) {
      for (let i = 0; i < shieldCount; i++) {
        const y = barsTop + shieldH / 2 + i * (shieldH + shieldGap) + shieldYOffset;
        this.drawShieldCard(shieldX, y, shieldW, shieldH);
      }
      this.drawBaseCard(baseX, baseYWithOffset, baseSize.w, baseSize.h, isTop);
    } else {
      for (let i = shieldCount - 1; i >= 0; i--) {
        const y = barsTop + shieldH / 2 + i * (shieldH + shieldGap) + shieldYOffset;
        this.drawShieldCard(shieldX, y, shieldW, shieldH);
      }
      this.drawBaseCard(baseX, baseYWithOffset, baseSize.w, baseSize.h, isTop);
    }
  }

  private drawShieldCard(x: number, y: number, w: number, h: number) {
    if (this.scene.textures.exists("deckBack")) {
      this.scene.add.image(x, y, "deckBack").setDisplaySize(w, h).setOrigin(0.5).setAngle(90);
    } else {
      this.drawHandStyleCard(x, y, w, h, this.drawHelpers.toColor("#b0b7c5"));
    }
  }

  private drawBaseCard(x: number, y: number, w: number, h: number, isTop: boolean) {
    const angle = isTop ? 180 : 0;
    if (this.scene.textures.exists("baseCard")) {
      this.scene.add.image(x, y, "baseCard").setDisplaySize(w, h).setOrigin(0.5).setAngle(angle);
    } else {
      this.drawHandStyleCard(x, y, w, h, this.drawHelpers.toColor("#c9d5e0")).setAngle(angle);
      this.scene
        .add.text(x, y, "base", { fontSize: "14px", fontFamily: "Arial", color: this.palette.ink })
        .setOrigin(0.5)
        .setAngle(angle);
    }

    // Overlay status text (scaled to base size)
    /*
    const restedFontSize = 14;
    const restedText = this.scene.add
      .text(x, y - h * 0.05, "Rested", {
        fontSize: `${restedFontSize}px`,
        fontFamily: "Arial",
        color: "#e74c3c",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setAngle(angle)
      .setDepth(500);
      */

    // Bottom-right count badge
    const badgeW = w * 0.5;
    const badgeH = h * 0.3;
    const badgeX = isTop ? x - w * 0.34 + 5: x + w * 0.34 -5;
    const badgeY = isTop ? y - h * 0.36 : y + h * 0.36;
    const badge = this.scene.add.rectangle(badgeX, badgeY, badgeW+5, badgeH, 0x000000, 0.9);
    badge.setOrigin(0.5).setAngle(angle).setDepth(500);
    const badgeFontSize = 20;
    this.scene
      .add.text(badgeX, badgeY, "0|3", {
        fontSize: `${badgeFontSize}px`,
        fontFamily: "Arial",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setAngle(angle)
      .setDepth(501);
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
}
