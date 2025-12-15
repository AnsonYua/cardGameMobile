import Phaser from "phaser";
import { DrawHelpers } from "./HeaderHandler";
import { Palette } from "./types";
import { toPreviewKey } from "./HandTypes";
import { drawPreviewBadge } from "./PreviewBadge";

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

type ShieldAreaConfig = {
  baseSize: BaseSize;
  shieldSize: BaseSize;
  shieldCount: number;
  shieldGap: number;
  towerGap: number;
  cornerRadius: number;
};

type BaseSide = "opponent" | "player";
export type ShieldAreaStatus = "normal" | "rested" | "destroyed";
type BaseCardObject = Phaser.GameObjects.Image | Phaser.GameObjects.Graphics;
type BadgePair = { box: Phaser.GameObjects.Graphics; label: Phaser.GameObjects.Text };

export type ShieldAreaControls = Pick<
  ShieldAreaHandler,
  | "setBaseStatus"
  | "setBaseBadgeLabel"
  | "setShieldCount"
  | "getShieldCount"
  | "setBaseTexture"
  | "setBaseTowerVisible"
  | "setBaseVisible"
  | "setBasePreviewData"
  | "setBaseClickHandler"
>;

export class ShieldAreaHandler {
  private config: ShieldAreaConfig = {
    baseSize: { w: 60, h: 80 },
    shieldSize: { w: 60, h: 80 },
    shieldCount: 0,
    shieldGap: -65,
    towerGap: -5,
    cornerRadius: 5,
  };
  private baseStatus: Record<BaseSide, ShieldAreaStatus> = { opponent: "normal", player: "normal" };
  private baseOverlays: Partial<Record<BaseSide, Phaser.GameObjects.Graphics>> = {};
  private baseMasks: Partial<Record<BaseSide, { mask: Phaser.Display.Masks.GeometryMask; shape: Phaser.GameObjects.Graphics }>> = {};
  private baseCards: Partial<Record<BaseSide, BaseCardObject>> = {};
  private badges: Partial<Record<BaseSide, BadgePair>> = {};
  private shieldCounts: Record<BaseSide, number>;
  private lastStackParams: Partial<Record<BaseSide, StackParams>> = {};
  private shieldCards: Record<BaseSide, Phaser.GameObjects.GameObject[]>;
  private baseHits: Partial<Record<BaseSide, Phaser.GameObjects.Zone>> = {};
  private basePreviewData: Partial<Record<BaseSide, any>> = {};
  private previewContainer?: Phaser.GameObjects.Container;
  private previewTimer?: any;
  private previewActive = false;
  private baseClickHandler?: (payload: { side: BaseSide; card?: any }) => void;
  private previewConfig = {
    holdDelay: 400,
    overlayAlpha: 0.65,
    cardWidth: 300,
    cardAspect: 88 / 64,
    badgeSize: { w: 70, h: 45 },
    badgeFontSize: 20,
    totalBadgeColor: 0x284cfc,
    totalBadgeGap: 10,
    fadeIn: 180,
    fadeOut: 150,
  };

  constructor(private scene: Phaser.Scene, private palette: Palette, private drawHelpers: DrawHelpers) {
    this.shieldCounts = { opponent: this.config.shieldCount, player: this.config.shieldCount };
    this.shieldCards = { opponent: [], player: [] };
  }

  setConfig(cfg: Partial<ShieldAreaConfig>) {
    this.config = { ...this.config, ...cfg };
    if (cfg.shieldCount !== undefined) {
      this.shieldCounts = { opponent: cfg.shieldCount, player: cfg.shieldCount };
    }
  }

  setBaseClickHandler(handler?: (payload: { side: BaseSide; card?: any }) => void) {
    this.baseClickHandler = handler;
  }

  getShieldCount(isOpponent?: boolean) {
    if (typeof isOpponent === "boolean") {
      return this.shieldCounts[isOpponent ? "opponent" : "player"];
    }
    return this.config.shieldCount;
  }

  // Set base status per side: pass `true` for opponent (top) and `false` for player (bottom); status is "normal" | "rested" | "destroyed".
  setBaseStatus(isOpponent: boolean, status: ShieldAreaStatus) {
    const key: BaseSide = isOpponent ? "opponent" : "player";
    this.baseStatus[key] = status;
    this.applyBaseStatus(key);
  }

  // Swap the rendered base texture to match the current base card (default fallback if not loaded).
  setBaseTexture(isOpponent: boolean, cardId?: string) {
    const key: BaseSide = isOpponent ? "opponent" : "player";
    const card = this.baseCards[key];
    if (!card) return;
    const targetKey = cardId === "base_default" ? "baseCard" : cardId ? toPreviewKey(cardId) : "baseCard";
    if (!(card instanceof Phaser.GameObjects.Image)) return;
    if (targetKey && this.scene.textures.exists(targetKey)) {
      card.setTexture(targetKey);
    } else if (this.scene.textures.exists("baseCard")) {
      card.setTexture("baseCard");
    }
    // Normalize display size so swapped textures keep the expected footprint.
    card.setDisplaySize(this.config.baseSize.w, this.config.baseSize.h);
  }

  // Update the base badge text per side (e.g., "3|6"); pass `true` for opponent (top) and `false` for player (bottom).
  setBaseBadgeLabel(isOpponent: boolean, text: string) {
    const key: BaseSide = isOpponent ? "opponent" : "player";
    const badge = this.badges[key];
    if (badge) {
      badge.label.setText(text);
    }
  }

  // Update the number of shield cards in the tower and redraw if already rendered.
  setShieldCount(isOpponent: boolean, count: number) {
    const key: BaseSide = isOpponent ? "opponent" : "player";
    this.shieldCounts[key] = count;
    const last = this.lastStackParams[key];
    if (last) {
      this.drawStack(last);
    }
  }

  // Show or hide the full base + shield tower for a side.
  setBaseTowerVisible(isOpponent: boolean, visible: boolean, fade = true) {
    const key: BaseSide = isOpponent ? "opponent" : "player";
    const status = this.baseStatus[key];
    const elements: Phaser.GameObjects.GameObject[] = [];
    if (this.baseCards[key]) elements.push(this.baseCards[key] as any);
    if (this.baseOverlays[key]) elements.push(this.baseOverlays[key] as any);
    const badge = this.badges[key];
    if (badge) elements.push(badge.box, badge.label);
    elements.push(...this.shieldCards[key]);
    const hit = this.baseHits[key];
    if (hit) elements.push(hit);

    // Toggle visibility immediately; no fades to avoid flashing on frequent updates.
    elements.forEach((el: any) => {
      if (!el) return;
      const shouldShow =
        visible &&
        !((el === this.baseOverlays[key] && status !== "rested") || (badge && (el === badge.box || el === badge.label) && status === "destroyed"));
      el.setVisible(shouldShow);
      if (typeof el.setAlpha === "function") el.setAlpha(1);
    });
  }

  // Show or hide only the base elements (card, overlay, badge) without affecting shields.
  setBaseVisible(isOpponent: boolean, visible: boolean) {
    const key: BaseSide = isOpponent ? "opponent" : "player";
    const elements: Phaser.GameObjects.GameObject[] = [];
    if (this.baseCards[key]) elements.push(this.baseCards[key] as any);
    if (this.baseOverlays[key]) elements.push(this.baseOverlays[key] as any);
    const badge = this.badges[key];
    if (badge) elements.push(badge.box, badge.label);
    const hit = this.baseHits[key];
    if (hit) elements.push(hit);
    elements.forEach((el: any) => {
      if (!el) return;
      el.setVisible(visible);
      if (typeof el.setAlpha === "function") el.setAlpha(visible ? 1 : 0);
    });
  }

  // Provide base payload (card + field values) for preview rendering.
  setBasePreviewData(isOpponent: boolean, baseCard: any | null) {
    const key: BaseSide = isOpponent ? "opponent" : "player";
    this.basePreviewData[key] = baseCard || null;
    const hit = this.baseHits[key];
    if (hit) {
      const enable = Boolean(baseCard);
      hit.setVisible(enable);
      enable ? hit.setInteractive({ useHandCursor: true }) : hit.disableInteractive();
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
    const side: BaseSide = isOpponent ? "opponent" : "player";
    this.lastStackParams[side] = params;
    const { baseSize, shieldSize, shieldGap, towerGap } = this.config;
    const shieldCount = this.shieldCounts[side] ?? this.config.shieldCount;
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
    console.log("asdfsasddf ",JSON.stringify(this.shieldCards) , " ",isOpponent)
    this.clearShieldsForSide(side);
    if (isOpponent) {
      for (let i = 0; i < shieldCount; i++) {
        const y = barsTop + shieldH / 2 + i * (shieldH + shieldGap) + shieldYOffset;
        const card = this.drawShieldCard(shieldX, y, shieldW, shieldH);
        this.shieldCards[side].push(card);
      }
      this.drawBaseCard(baseX, baseYWithOffset, baseSize.w, baseSize.h, isOpponent);
    } else {
      for (let i = shieldCount - 1; i >= 0; i--) {
        const y = barsTop + shieldH / 2 + i * (shieldH + shieldGap) + shieldYOffset;
        const card = this.drawShieldCard(shieldX, y, shieldW, shieldH);
        this.shieldCards[side].push(card);
      }
      this.drawBaseCard(baseX, baseYWithOffset, baseSize.w, baseSize.h, isOpponent);
    }
  }

  private clearShieldsForSide(side: BaseSide) {
    this.shieldCards[side].forEach((c) => c.destroy());
    this.shieldCards[side] = [];
  }

  private drawShieldCard(x: number, y: number, w: number, h: number) {
    if (this.scene.textures.exists("deckBack")) {
      return this.scene.add.image(x, y, "deckBack").setDisplaySize(w, h).setOrigin(0.5).setAngle(90);
    } else {
      return this.drawHandStyleCard(x, y, w, h, this.drawHelpers.toColor("#b0b7c5"), this.config.cornerRadius);
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
    this.baseHits[overlayKey]?.destroy();
    this.baseHits[overlayKey] = undefined;

    if (this.scene.textures.exists("baseCard")) {
      const baseImg = this.scene.add.image(x, y, "baseCard").setDisplaySize(w, h).setOrigin(0.5).setAngle(angle).setDepth(490);
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
      card.setDepth(490);
      this.baseCards[overlayKey] = card;
      this.scene
        .add.text(x, y, "base", { fontSize: "14px", fontFamily: "Arial", color: this.palette.ink })
        .setOrigin(0.5)
        .setAngle(angle)
        .setDepth(491);
    }

    // Grey transparent overlay as rested indicator; draw centered so rotation pivots correctly.
    const restedOverlay = this.scene.add.graphics({ x, y });
    restedOverlay.fillStyle(0x666666, 0.25);
    restedOverlay.fillRoundedRect(-w / 2, -h / 2, w, h, radius);
    restedOverlay.setDepth(495).setAngle(angle).setVisible(this.baseStatus[overlayKey] === "rested");
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

    // Interactive zone for long-press preview.
    const hit = this.scene.add.zone(x, y, w * 1.2, h * 1.2).setOrigin(0.5).setInteractive({ useHandCursor: true });
    hit.setDepth(9999);
    this.scene.children.bringToTop(hit);
    hit.on("pointerdown", () => this.startPreviewTimer(overlayKey));
    hit.on("pointerup", () => this.handlePointerUp(overlayKey));
    hit.on("pointerout", () => this.handlePointerOut());
    this.baseHits[overlayKey] = hit;

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

  // --- Preview handling for base card ---
  private startPreviewTimer(side: BaseSide) {
    console.log("Base preview: start timer", { side, holdDelay: this.previewConfig.holdDelay });
    this.hidePreview(true);
    this.previewTimer = setTimeout(() => {
      this.previewTimer = undefined;
      console.log("Base preview: trigger show", { side });
      this.showPreview(side);
    }, this.previewConfig.holdDelay);
  }

  private handlePointerUp(side: BaseSide) {
    console.log("Base preview: pointerup", { previewActive: this.previewActive });
    if (this.previewActive) return;
    this.cancelPreviewTimer();
    this.baseClickHandler?.({ side, card: this.basePreviewData[side] });
  }

  private handlePointerOut() {
    console.log("Base preview: pointerout", { previewActive: this.previewActive });
    if (this.previewActive) return;
    this.cancelPreviewTimer();
  }

  private cancelPreviewTimer() {
    console.log("Base preview: cancel timer", { hasTimer: !!this.previewTimer });
    if (this.previewTimer) {
      clearTimeout(this.previewTimer);
      this.previewTimer = undefined;
    }
  }

  private showPreview(side: BaseSide) {
    const payload = this.basePreviewData[side];
      console.log("payload ",JSON.stringify(this.basePreviewData))
    if (!payload) {
      console.log("Base preview: no payload for side", side);
      return;
    }
    console.log("Base preview: render payload", { side, payloadCardId: payload?.cardId, field: payload?.fieldCardValue });
    const cam = this.scene.cameras.main;
    const cx = cam.centerX;
    const cy = cam.centerY;
    const cardW = this.previewConfig.cardWidth;
    const cardH = cardW * this.previewConfig.cardAspect;
    const container = this.scene.add.container(cx, cy).setDepth(5000).setAlpha(0);

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x000000, this.previewConfig.overlayAlpha);
    bg.fillRect(-cam.width / 2, -cam.height / 2, cam.width, cam.height);
    bg.setInteractive(new Phaser.Geom.Rectangle(-cam.width / 2, -cam.height / 2, cam.width, cam.height), Phaser.Geom.Rectangle.Contains);
    bg.on("pointerdown", () => this.hidePreview());
    container.add(bg);

    this.drawPreviewCard(container, 0, 0, cardW, cardH, payload);

    this.previewContainer = container;
    this.previewActive = true;
    this.scene.tweens.add({
      targets: container,
      alpha: 1,
      duration: this.previewConfig.fadeIn,
      ease: "Quad.easeOut",
    });
  }

  private hidePreview(skipTween = false) {
    this.cancelPreviewTimer();
    if (this.previewContainer) {
      const target = this.previewContainer;
      this.previewContainer = undefined;
      target.iterate((child: any) => {
        if (child?.removeAllListeners) child.removeAllListeners();
      });
      if (skipTween) {
        target.destroy();
      } else {
        this.scene.tweens.add({
          targets: target,
          alpha: 0,
          duration: this.previewConfig.fadeOut,
          ease: "Quad.easeIn",
          onComplete: () => target.destroy(),
        });
      }
    }
    this.previewActive = false;
  }

  private drawPreviewCard(
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    w: number,
    h: number,
    baseCard: any,
  ) {
    const cardId = baseCard?.cardId;
    const field = baseCard?.fieldCardValue || {};
    const texKey = cardId === "base_default" ? "baseCard" : cardId;
    const hasTex = texKey && this.scene.textures.exists(texKey);
    const img = hasTex
      ? this.scene.add.image(x, y, texKey!).setDisplaySize(w, h).setOrigin(0.5)
      : this.drawHelpers.drawRoundedRect({
          x,
          y,
          width: w,
          height: h,
          radius: 12,
          fillColor: "#cbd3df",
          fillAlpha: 0.9,
          strokeColor: "#0f1118",
          strokeAlpha: 0.8,
          strokeWidth: 2,
        });
    img.setDepth(1);
    container.add(img);

    const badgeW = this.previewConfig.badgeSize.w;
    const badgeH = this.previewConfig.badgeSize.h;
    // Black badge bottom-right: totalOriginalAP|totalOriginalHP
    const origAp = Number(field.totalOriginalAP ?? 0);
    const origHp = Number(field.totalOriginalHP ?? 0);
    this.drawPreviewBadge(
      container,
      x + w / 2 - badgeW / 2,
      y + h / 2 - badgeH / 2,
      badgeW,
      badgeH,
      `${origAp}|${origHp}`,
      2,
      0x000000,
    );
    // Blue total badge below stack: totalAP|totalHP
    const totAp = Number(field.totalAP ?? 0);
    const totHp = Number(field.totalHP ?? 0);
    this.drawPreviewBadge(
      container,
      x + w / 2 - badgeW / 2,
      y + h / 2 - badgeH / 2 + this.previewConfig.badgeSize.h + this.previewConfig.totalBadgeGap,
      badgeW,
      badgeH,
      `${totAp}|${totHp}`,
      2,
      this.previewConfig.totalBadgeColor,
    );
  }

  private drawPreviewBadge(
    container: Phaser.GameObjects.Container,
    badgeX: number,
    badgeY: number,
    w: number,
    h: number,
    label: string,
    baseDepth: number,
    fillColor: number,
  ) {
    drawPreviewBadge({
      container,
      drawHelpers: this.drawHelpers,
      x: badgeX,
      y: badgeY,
      width: w,
      height: h,
      label,
      baseDepth,
      fillColor,
      fillAlpha: 0.9,
      radius: 6,
      widthPad: 0,
      depthPillOffset: 1,
      depthTextOffset: 2,
      textStyle: {
        fontSize: `${this.previewConfig.badgeFontSize}px`,
        fontFamily: "Arial",
        fontStyle: "bold",
        color: "#ffffff",
      },
    });
  }
}
