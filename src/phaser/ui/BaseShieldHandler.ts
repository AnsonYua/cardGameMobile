import Phaser from "phaser";
import { DrawHelpers } from "./HeaderHandler";
import { Palette } from "./types";

type BaseSize = { w: number; h: number };

type StackParams = {
  towerX: number;
  originY: number;
  isOpponent: boolean;
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
  cornerRadius: number;
};

type BaseSide = "opponent" | "player";
export type BaseStatus = "normal" | "rested" | "destroyed";
type BaseCardObject = Phaser.GameObjects.Image | Phaser.GameObjects.Graphics;
type BadgePair = { box: Phaser.GameObjects.Graphics; label: Phaser.GameObjects.Text };

export class BaseShieldHandler {
  private config: BaseShieldConfig = {
    baseSize: { w: 60, h: 80 },
    shieldSize: { w: 60, h: 80 },
    shieldCount: 6,
    shieldGap: -65,
    towerGap: -5,
    cornerRadius: 5,
  };
  private baseStatus: Record<BaseSide, BaseStatus> = { opponent: "normal", player: "normal" };
  private baseOverlays: Partial<Record<BaseSide, Phaser.GameObjects.Graphics>> = {};
  private baseMasks: Partial<Record<BaseSide, { mask: Phaser.Display.Masks.GeometryMask; shape: Phaser.GameObjects.Graphics }>> = {};
  private baseCards: Partial<Record<BaseSide, BaseCardObject>> = {};
  private badges: Partial<Record<BaseSide, BadgePair>> = {};

  constructor(private scene: Phaser.Scene, private palette: Palette, private drawHelpers: DrawHelpers) {}

  setConfig(cfg: Partial<BaseShieldConfig>) {
    this.config = { ...this.config, ...cfg };
  }

  getShieldCount() {
    return this.config.shieldCount;
  }

// Set base status per side: pass `true` for opponent (top) and `false` for player (bottom); status is "normal" | "rested" | "destroyed".
  setBaseStatus(isOpponent: boolean, status: BaseStatus) {
    const key: BaseSide = isOpponent ? "opponent" : "player";
    this.baseStatus[key] = status;
    this.applyBaseStatus(key);
  }

  // Update the base badge text per side (e.g., "3|6"); pass `true` for opponent (top) and `false` for player (bottom).
  setBaseBadgeLabel(isOpponent: boolean, text: string) {
    const key: BaseSide = isOpponent ? "opponent" : "player";
    const badge = this.badges[key];
    if (badge) {
      badge.label.setText(text);
    }
  }

  private computeStackHeight(
    shieldCount: number,
    shieldH: number,
    shieldGap: number,
    towerGap: number,
    baseHeight: number,
    isOpponent: boolean,
  ) {
    const totalBarsHeight = shieldCount * shieldH + (shieldCount - 1) * shieldGap;
    const baseOverlap = 20;
    return isOpponent
      ? totalBarsHeight + towerGap - baseOverlap + baseHeight
      : baseHeight - baseOverlap + towerGap + totalBarsHeight;
  }

  drawStack(params: StackParams) {
    const { towerX, originY, isOpponent, offsets, headerHeight, headerGap } = params;
    const { baseSize, shieldSize, shieldCount, shieldGap, towerGap } = this.config;
    const shieldX = towerX + offsets.shieldCenterX;
    const baseX = towerX + offsets.baseCenterX;
    const shieldW = shieldSize.w;
    const shieldH = shieldSize.h;
    const stackHeight = this.computeStackHeight(shieldCount, shieldH, shieldGap, towerGap, baseSize.h, isOpponent);
    const baseStackTop = isOpponent ? headerHeight + headerGap : originY - stackHeight / 2;
    const stackTop = baseStackTop + offsets.towerOffsetY;
    const shieldYOffset = offsets.shieldCenterY;
    const baseYOffset = offsets.baseCenterY;
    const totalBarsHeight = shieldCount * shieldH + (shieldCount - 1) * shieldGap;
    const baseOverlap = 20;
    const barsTop = isOpponent ? stackTop : stackTop + baseSize.h - baseOverlap + towerGap;
    const baseY = isOpponent
      ? barsTop + totalBarsHeight + towerGap - baseOverlap + baseSize.h / 2
      : stackTop + baseSize.h / 2 - baseOverlap / 2;
    const baseYWithOffset = baseY + baseYOffset;

    if (isOpponent) {
      for (let i = 0; i < shieldCount; i++) {
        const y = barsTop + shieldH / 2 + i * (shieldH + shieldGap) + shieldYOffset;
        this.drawShieldCard(shieldX, y, shieldW, shieldH);
      }
      this.drawBaseCard(baseX, baseYWithOffset, baseSize.w, baseSize.h, isOpponent);
    } else {
      for (let i = shieldCount - 1; i >= 0; i--) {
        const y = barsTop + shieldH / 2 + i * (shieldH + shieldGap) + shieldYOffset;
        this.drawShieldCard(shieldX, y, shieldW, shieldH);
      }
      this.drawBaseCard(baseX, baseYWithOffset, baseSize.w, baseSize.h, isOpponent);
    }
  }

  private drawShieldCard(x: number, y: number, w: number, h: number) {
    if (this.scene.textures.exists("deckBack")) {
      this.scene.add.image(x, y, "deckBack").setDisplaySize(w, h).setOrigin(0.5).setAngle(90);
    } else {
      this.drawHandStyleCard(x, y, w, h, this.drawHelpers.toColor("#b0b7c5"), this.config.cornerRadius);
    }
  }

  private drawBaseCard(x: number, y: number, w: number, h: number, isOpponent: boolean) {
    const angle = isOpponent ? 180 : 0;
    const overlayKey = isOpponent ? "opponent" : "player";
    const radius = this.config.cornerRadius;
    // Clean up any previous overlay for this side before drawing anew.
    this.baseOverlays[overlayKey]?.destroy();
    this.baseOverlays[overlayKey] = undefined;
    this.baseMasks[overlayKey]?.shape.destroy();
    this.baseMasks[overlayKey]?.mask.destroy();
    this.baseMasks[overlayKey] = undefined;
    this.baseCards[overlayKey]?.destroy();
    this.baseCards[overlayKey] = undefined;
    this.badges[overlayKey]?.box.destroy();
    this.badges[overlayKey]?.label.destroy();
    this.badges[overlayKey] = undefined;

    if (this.scene.textures.exists("baseCard")) {
      const baseImg = this.scene.add.image(x, y, "baseCard").setDisplaySize(w, h).setOrigin(0.5).setAngle(angle);
      // Rounded corner mask so the transparent PNG keeps its soft edges.
      const shape = this.scene.add.graphics({ x: x - w / 2, y: y - h / 2 });
      shape.fillStyle(0xffffff, 1);
      shape.fillRoundedRect(0, 0, w, h, radius);
      shape.setVisible(false);
      const mask = shape.createGeometryMask();
      baseImg.setMask(mask);
      this.baseMasks[overlayKey] = { mask, shape };
      this.baseCards[overlayKey] = baseImg;
    } else {
      const card = this.drawHandStyleCard(x, y, w, h, this.drawHelpers.toColor("#c9d5e0"), radius).setAngle(angle);
      this.baseCards[overlayKey] = card;
      this.scene
        .add.text(x, y, "base", { fontSize: "14px", fontFamily: "Arial", color: this.palette.ink })
        .setOrigin(0.5)
        .setAngle(angle);
    }

    // Grey transparent overlay as rested indicator; always created, visibility controlled by state.
    const restedOverlay = this.drawHelpers
      .drawRoundedRect({
        x,
        y,
        width: w,
        height: h,
        radius,
        fillColor: 0x666666,
        fillAlpha: 0.25,
        strokeAlpha: 0,
        strokeWidth: 0,
      })
      .setDepth(495)
      .setAngle(angle)
      .setVisible(this.baseStatus[overlayKey] === "rested");
    this.baseOverlays[overlayKey] = restedOverlay;

    // Bottom-right count badge
    const badgeW = w * 0.5;
    const badgeH = h * 0.3;
    const badgeX = isOpponent ? x - w * 0.34 + 5 : x + w * 0.34 - 5;
    const badgeY = isOpponent ? y - h * 0.36 : y + h * 0.36;

    const badgeRectX = badgeX;
    const badgeRectY = badgeY;
    const badge = this.drawHelpers.drawRoundedRect({
      x: badgeRectX,
      y: badgeRectY,
      width: badgeW + 5,
      height: badgeH,
      radius: 6,
      fillColor: 0x000000,
      fillAlpha: 0.9,
      strokeAlpha: 0,
      strokeWidth: 0,
    });
    badge.setDepth(500);
    const badgeFontSize = 20;
    const badgeLabel = this.scene
      .add.text(badgeX, badgeY, "0|3", {
        fontSize: `${badgeFontSize}px`,
        fontFamily: "Arial",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setAngle(angle)
      .setDepth(501);
    this.badges[overlayKey] = { box: badge, label: badgeLabel };

    // Apply any previously-set status now that visuals exist.
    this.applyBaseStatus(overlayKey);
  }

  private applyBaseStatus(side: BaseSide) {
    const status = this.baseStatus[side];
    const overlay = this.baseOverlays[side];
    const card = this.baseCards[side];
    const badge = this.badges[side];

    if (!overlay && !card && !badge) {
      return;
    }

    // Rested overlay visibility
    overlay?.setVisible(status === "rested");
    // Base visibility (hidden if destroyed)
    card?.setVisible(status !== "destroyed");
    // Badge visibility mirrors base visibility.
    badge?.box.setVisible(status !== "destroyed");
    badge?.label.setVisible(status !== "destroyed");
  }

  private drawHandStyleCard(x: number, y: number, w: number, h: number, fill: number, cornerRadius: number) {
    const outerRadius = Math.max(cornerRadius + 2, 0);
    const innerRadius = Math.max(cornerRadius, 0);
    const outer = this.drawHelpers.drawRoundedRect({
      x,
      y,
      width: w,
      height: h,
      radius: outerRadius,
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
      radius: innerRadius,
      fillColor: this.drawHelpers.toColor("#d7a97d"),
      fillAlpha: 0.6,
      strokeColor: this.drawHelpers.toColor("#9b6c4b"),
      strokeAlpha: 0.7,
      strokeWidth: 2,
    });
    return outer;
  }
}
