import Phaser from "phaser";
import { DrawHelpers } from "./HeaderHandler";
import { Palette } from "./types";
import { toPreviewKey } from "./HandTypes";
import { drawPreviewBadge } from "./PreviewBadge";
import { PlayCardAnimationManager } from "../animations/PlayCardAnimationManager";

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
  restedAnglePlayer: number;
  restedAngleOpponent: number;
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
  | "setBaseInputEnabled"
  | "getBaseAnchor"
  | "getShieldTopAnchor"
>;

export class ShieldAreaHandler {
  private config: ShieldAreaConfig = {
    baseSize: { w: 60, h: 80 },
    shieldSize: { w: 60, h: 80 },
    shieldCount: 0,
    shieldGap: -65,
    towerGap: -5,
    cornerRadius: 5,
    restedAnglePlayer: -90,
    restedAngleOpponent: -90,
  };
  private baseStatus: Record<BaseSide, ShieldAreaStatus> = { opponent: "normal", player: "normal" };
  private baseCards: Partial<Record<BaseSide, BaseCardObject>> = {};
  private badges: Partial<Record<BaseSide, BadgePair>> = {};
  private baseContainers: Partial<Record<BaseSide, Phaser.GameObjects.Container>> = {};
  private shieldCounts: Record<BaseSide, number>;
  private lastStackParams: Partial<Record<BaseSide, StackParams>> = {};
  private shieldCards: Record<BaseSide, Phaser.GameObjects.GameObject[]>;
  private baseHits: Partial<Record<BaseSide, Phaser.GameObjects.Zone>> = {};
  private basePreviewData: Partial<Record<BaseSide, any>> = {};
  private previewContainer?: Phaser.GameObjects.Container;
  private previewTimer?: any;
  private previewActive = false;
  private baseClickHandler?: (payload: { side: BaseSide; card?: any }) => void;
  private baseAnchors: Partial<Record<BaseSide, { x: number; y: number; isOpponent: boolean; w: number; h: number }>> =
    {};
  private shieldAnchors: Partial<Record<BaseSide, { x: number; y: number }>> = {};
  private playAnimator: PlayCardAnimationManager;
  private lastBaseCardId: Partial<Record<BaseSide, string>> = {};
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
    this.playAnimator = new PlayCardAnimationManager(scene);
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

  setBaseInputEnabled(enabled: boolean) {
    (Object.values(this.baseHits) as Phaser.GameObjects.Zone[]).forEach((hit) => {
      if (!hit) return;
      if (enabled) {
        hit.setInteractive({ useHandCursor: true });
      } else {
        hit.disableInteractive();
      }
    });
  }

  getShieldCount(isOpponent?: boolean) {
    if (typeof isOpponent === "boolean") {
      return this.shieldCounts[isOpponent ? "opponent" : "player"];
    }
    return this.config.shieldCount;
  }

  getBaseAnchor(isOpponent: boolean) {
    return this.baseAnchors[isOpponent ? "opponent" : "player"];
  }

  getShieldTopAnchor(isOpponent: boolean) {
    const side: BaseSide = isOpponent ? "opponent" : "player";
    const anchor = this.shieldAnchors[side];
    return anchor;
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
  setBaseTowerVisible(isOpponent: boolean, visible: boolean) {
    const key: BaseSide = isOpponent ? "opponent" : "player";
    const status = this.baseStatus[key];
    const elements: Phaser.GameObjects.GameObject[] = [];
    if (this.baseContainers[key]) elements.push(this.baseContainers[key] as any);
    elements.push(...this.shieldCards[key]);
    const hit = this.baseHits[key];
    if (hit) elements.push(hit);

    // Toggle visibility immediately; no fades to avoid flashing on frequent updates.
    elements.forEach((el: any) => {
      if (!el) return;
      const shouldShow = visible && !(el === this.baseContainers[key] && status === "destroyed");
      el.setVisible(shouldShow);
      if (typeof el.setAlpha === "function") el.setAlpha(1);
    });
  }

  // Show or hide only the base elements (card, overlay, badge) without affecting shields.
  setBaseVisible(isOpponent: boolean, visible: boolean) {
    const key: BaseSide = isOpponent ? "opponent" : "player";
    const elements: Phaser.GameObjects.GameObject[] = [];
    if (this.baseContainers[key]) elements.push(this.baseContainers[key] as any);
    const hit = this.baseHits[key];
    if (hit) elements.push(hit);
    elements.forEach((el: any) => {
      if (!el) return;
      el.setVisible(visible);
      if (typeof el.setAlpha === "function") el.setAlpha(visible ? 1 : 0);
    });
  }

  // Provide base payload (card + field values) for preview rendering.
  setBasePreviewData(isOpponent: boolean, baseCard: any | null, opts?: { allowAnimation?: boolean }) {
    const key: BaseSide = isOpponent ? "opponent" : "player";
    const allowAnimation = opts?.allowAnimation === true;
    const prevCardId = this.lastBaseCardId[key];
    const nextCardId = baseCard?.cardId;
    const isNewCard = nextCardId && nextCardId !== prevCardId;
    this.basePreviewData[key] = baseCard || null;
    const hit = this.baseHits[key];
    if (hit) {
      const enable = Boolean(baseCard);
      hit.setVisible(enable);
      enable ? hit.setInteractive({ useHandCursor: true }) : hit.disableInteractive();
    }

    // Trigger base play animation when a new base arrives.
    if (isNewCard && allowAnimation) {
      const anchor = this.baseAnchors[key];
      if (anchor) {
        const cam = this.scene.cameras.main;
        const start = {
          x: cam.centerX,
          y: anchor.isOpponent ? cam.height * 0.12 : cam.height - 60,
        };
        const field = baseCard?.fieldCardValue || {};
        const stats = { ap: field.totalAP ?? 0, hp: field.totalHP ?? 0 };
        const textureKey = toPreviewKey(baseCard?.cardId) || baseCard?.cardId;
        const size = { w: anchor.w ?? this.config.baseSize.w, h: anchor.h ?? this.config.baseSize.h };
        // Match hand/unit flight visuals (use default PlayCardAnimationManager sizing).
        this.playAnimator.play({
          textureKey: textureKey === "base_default-preview" ? "baseCard" : textureKey,
          fallbackLabel: baseCard?.cardId,
          start,
          end: { x: anchor.x, y: anchor.y },
          isOpponent: anchor.isOpponent,
          cardName: baseCard?.cardData?.name || baseCard?.cardId,
          stats,
          size,
        });
      }
    }

    this.lastBaseCardId[key] = nextCardId || undefined;
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
    this.clearShieldsForSide(side);
    if (shieldCount > 0) {
      const topIndex = 0;
      const shieldTopY = barsTop + shieldH / 2 + topIndex * (shieldH + shieldGap) + shieldYOffset;
      this.shieldAnchors[side] = { x: shieldX, y: shieldTopY };
    } else {
      this.shieldAnchors[side] = undefined;
    }
    if (isOpponent) {
      for (let i = 0; i < shieldCount; i++) {
        const y = barsTop + shieldH / 2 + i * (shieldH + shieldGap) + shieldYOffset;
        const card = this.drawShieldCard(shieldX, y, shieldW, shieldH);
        this.shieldCards[side].push(card);
      }
      this.updateShieldAnchorFromCards(side, shieldX);
      this.drawBaseCard(baseX, baseYWithOffset, baseSize.w, baseSize.h, isOpponent);
    } else {
      for (let i = shieldCount - 1; i >= 0; i--) {
        const y = barsTop + shieldH / 2 + i * (shieldH + shieldGap) + shieldYOffset;
        const card = this.drawShieldCard(shieldX, y, shieldW, shieldH);
        this.shieldCards[side].push(card);
      }
      this.updateShieldAnchorFromCards(side, shieldX);
      this.drawBaseCard(baseX, baseYWithOffset, baseSize.w, baseSize.h, isOpponent);
    }
  }

  private updateShieldAnchorFromCards(side: BaseSide, fallbackX: number) {
    const cards = this.shieldCards[side];
    if (!cards.length) {
      this.shieldAnchors[side] = undefined;
      return;
    }
    const topCard = cards.reduce((best, card) => ((card as any).y < (best as any).y ? card : best), cards[0]);
    const x = (topCard as any).x ?? fallbackX;
    const centerY = (topCard as any).y ?? this.shieldAnchors[side]?.y ?? 0;
    const y = centerY - this.config.shieldSize.h / 2;
    this.shieldAnchors[side] = { x, y };
  }

  private clearShieldsForSide(side: BaseSide) {
    this.shieldCards[side].forEach((c) => c.destroy());
    this.shieldCards[side] = [];
    this.shieldAnchors[side] = undefined;
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
    this.baseAnchors[overlayKey] = { x, y, isOpponent, w, h };
    // Clean up any previous base visuals for this side before drawing anew.
    this.baseContainers[overlayKey]?.destroy();
    this.baseContainers[overlayKey] = undefined;
    this.baseCards[overlayKey]?.destroy();
    this.baseCards[overlayKey] = undefined;
    this.badges[overlayKey]?.box.destroy();
    this.badges[overlayKey]?.label.destroy();
    this.badges[overlayKey] = undefined;
    this.baseHits[overlayKey]?.destroy();
    this.baseHits[overlayKey] = undefined;

    const container = this.scene.add.container(x, y).setDepth(490);
    this.baseContainers[overlayKey] = container;
    container.setAngle(this.getBaseAngle(overlayKey, this.baseStatus[overlayKey]));

    const hasTexture = this.scene.textures.exists("baseCard");
    if (hasTexture) {
      const baseImg = this.scene.add.image(0, 0, "baseCard").setDisplaySize(w, h).setOrigin(0.5);
      this.baseCards[overlayKey] = baseImg;
      container.add(baseImg);
    } else {
      const card = this.drawHandStyleCard(0, 0, w, h, this.drawHelpers.toColor("#c9d5e0"), radius);
      this.baseCards[overlayKey] = card;
      const label = this.scene
        .add.text(0, 0, "base", { fontSize: "14px", fontFamily: "Arial", color: this.palette.ink })
        .setOrigin(0.5);
      container.add([card, label]);
    }

    // Bottom-right count badge
    const badgeW = w * 0.5;
    const badgeH = h * 0.3;
    const badgeX = isOpponent ? w * 0.34 - 5 : w * 0.34 - 5;
    const badgeY = isOpponent ? h * 0.36 : h * 0.36;

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
      .setDepth(501);
    this.badges[overlayKey] = { box: badge, label: badgeLabel };
    container.add([badge, badgeLabel]);

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
    const container = this.baseContainers[side];

    if (!container) {
      return;
    }

    // Base visibility (hidden if destroyed)
    container.setVisible(status !== "destroyed");
    container.setAngle(this.getBaseAngle(side, status));
  }

  private getBaseAngle(side: BaseSide, status: ShieldAreaStatus) {
    const baseAngle = side === "opponent" ? 180 : 0;
    if (status !== "rested") return baseAngle;
    const restAngle = side === "opponent" ? this.config.restedAngleOpponent : this.config.restedAnglePlayer;
    return baseAngle + restAngle;
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
    this.hidePreview(true);
    this.previewTimer = setTimeout(() => {
      this.previewTimer = undefined;
      this.showPreview(side);
    }, this.previewConfig.holdDelay);
  }

  private handlePointerUp(side: BaseSide) {
    if (this.previewActive) return;
    this.cancelPreviewTimer();
    this.baseClickHandler?.({ side, card: this.basePreviewData[side] });
  }

  private handlePointerOut() {
    if (this.previewActive) return;
    this.cancelPreviewTimer();
  }

  private cancelPreviewTimer() {
    if (this.previewTimer) {
      clearTimeout(this.previewTimer);
      this.previewTimer = undefined;
    }
  }

  private showPreview(side: BaseSide) {
    const payload = this.basePreviewData[side];
    if (!payload) {
      return;
    }
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
