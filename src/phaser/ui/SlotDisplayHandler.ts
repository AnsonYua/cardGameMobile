import Phaser from "phaser";
import { DrawHelpers } from "./HeaderHandler";
import { Palette } from "./types";
import { SlotPositionMap, SlotViewModel, SlotCardView, SlotOwner } from "./SlotTypes";
import { PlayCardAnimationManager } from "../animations/PlayCardAnimationManager";
import { UI_LAYOUT } from "./UiLayoutConfig";
import { PreviewController } from "./PreviewController";
import { renderSlotPreviewCard } from "./SlotPreviewRenderer";

type RenderOptions = {
  positions: SlotPositionMap;
};

export class SlotDisplayHandler {
  private cardAspect = 63 / 88;
  private slotContainers = new Map<string, Phaser.GameObjects.Container>();
  private selectedKey?: string;
  private lastSlots: SlotViewModel[] = [];
  private playAnimator: PlayCardAnimationManager;
  private entryAnimationsEnabled = false;
  private lastPositions?: SlotPositionMap;
  // Centralized tuning knobs so visuals stay consistent without hunting magic numbers.
  private config = {
    slot: {
      cardScale: 0.75,
      restedScale: 0.65,
      restedAngle: -90,
      restedAlpha: 1,
      borderStroke: 3,
      defaultBorderColor: 0xffffff,
      selectedBorderColor: 0x18c56c,
      defaultBorderAlpha: 0.75,
      selectedBorderAlpha: 1,
      pilotSliceRatio: 0.15,
      showPilotInSlots: true,
      unitRatio: 0.75,
      pilotAlpha: 0.95,
      statsBadge: {
        wFactor: 0.4,
        hFactor: 0.3,
        xFactor: 0.34,
        yFactor: 0.36,
        fontMin: 12,
        fontMax: 16,
      },
    },
    preview: UI_LAYOUT.slot.preview,
  };
  private lastStatLabels = new Map<string, { label: string; score: number }>();
  private animatingSlots = new Map<string, string | null>();
  private statLabelNodes = new Map<string, { text: Phaser.GameObjects.Text; pill: Phaser.GameObjects.GameObject }>();
  private hiddenSlots = new Set<string>();

  private previewController: PreviewController;

  constructor(private scene: Phaser.Scene, private palette: Palette, private drawHelpers: DrawHelpers) {
    this.playAnimator = new PlayCardAnimationManager(scene);
    this.previewController = new PreviewController(scene, {
      overlayAlpha: this.config.preview.overlayAlpha,
      fadeIn: this.config.preview.fadeIn,
      fadeOut: this.config.preview.fadeOut,
      holdDelay: this.config.preview.holdDelay,
      depth: 5000,
    });
  }
  private onSlotClick?: (slot: SlotViewModel) => void;
  private slotClicksEnabled = true;

  setSlotClickHandler(handler?: (slot: SlotViewModel) => void) {
    this.onSlotClick = handler;
  }

  setSlotClickEnabled(enabled: boolean) {
    this.slotClicksEnabled = enabled;
  }

  setPlayAnimations(enabled: boolean) {
    this.entryAnimationsEnabled = enabled;
  }

  setSlotVisible(owner: SlotOwner, slotId: string, visible: boolean) {
    const key = `${owner}-${slotId}`;
    if (!visible) {
      this.hiddenSlots.add(key);
    } else {
      this.hiddenSlots.delete(key);
    }
    const container = this.slotContainers.get(key);
    if (container) {
      container.setVisible(visible);
    } else {
    }
  }

  getSlotAreaCenter(owner: SlotOwner): { x: number; y: number } | undefined {
    const positions = this.lastPositions?.[owner];
    if (!positions) return undefined;
    const vals = Object.values(positions);
    if (!vals.length) return undefined;
    const sum = vals.reduce(
      (acc, p) => {
        acc.x += p.x;
        acc.y += p.y;
        return acc;
      },
      { x: 0, y: 0 },
    );
    return { x: sum.x / vals.length, y: sum.y / vals.length };
  }

  playCardAnimation(
    slot: SlotViewModel,
    card?: SlotCardView,
    startOverride?: { x: number; y: number; isOpponent?: boolean },
    endOverride?: { x: number; y: number; isOpponent?: boolean },
  ) {
    if (!this.lastPositions) return;
    const pos = endOverride ?? this.lastPositions?.[slot.owner]?.[slot.slotId];
    if (!pos) return;
    const normalizedPos = { x: pos.x, y: pos.y, isOpponent: pos.isOpponent ?? slot.owner === "opponent" };
    this.animateCardEntry(slot, normalizedPos, card, startOverride);
  }
  setSelectedSlot(slotKey?: string) {
    this.selectedKey = slotKey;
    this.rerenderLast();
  }

  render(slots: SlotViewModel[], { positions }: RenderOptions) {
    const prevSlots = this.lastSlots;
    this.lastSlots = slots.map((s) => ({ ...s }));
    this.lastPositions = positions;
    const nextKeys = new Set<string>();
    slots.forEach((slot) => {
      const pos = positions[slot.owner]?.[slot.slotId];
      if (!pos) return;
      const key = `${slot.owner}-${slot.slotId}`;
      nextKeys.add(key);
      const prev = prevSlots.find((s) => s.owner === slot.owner && s.slotId === slot.slotId);
      const hadCard = !!(prev && (prev.unit || prev.pilot));
      const hasCard = !!(slot.unit || slot.pilot);
      const pilotAdded = !prev?.pilot && !!slot.pilot;
      this.slotContainers.get(key)?.destroy();

      const isSelected = this.selectedKey === key;
      const container = this.scene.add.container(pos.x, pos.y);
      container.setDepth(pos.isOpponent ? 30 : 40);
      container.setSize(pos.w, pos.h);
      container.setInteractive({ useHandCursor: false });
      container.on("pointerdown", () => this.startPreviewTimer(slot));
      container.on("pointerup", () => this.handlePointerUp(slot));
      container.on("pointerout", () => this.handlePointerOut());

      // No background frame; rely on card art only.
      this.drawSlot(container, pos.w, pos.h, slot, isSelected);
      container.setAlpha(slot.isRested ? this.config.slot.restedAlpha : 1);
      container.setAngle(slot.isRested ? this.config.slot.restedAngle : 0);

      this.slotContainers.set(key, container);
      if (this.hiddenSlots.has(key)) {
        container.setVisible(false);
      }

      // Trigger entry animation only when a card just appeared in an empty slot.
      if (this.entryAnimationsEnabled) {
        if (!hadCard && hasCard) {
          if (!this.isCommandCard(slot.unit || slot.pilot)) {
            this.animateCardEntry(slot, pos);
          }
        } else if (pilotAdded) {
          if (!this.isCommandCard(slot.pilot)) {
            this.animateCardEntry(slot, pos, slot.pilot);
          }
        }
      }
    });

    Array.from(this.slotContainers.entries()).forEach(([key, container]) => {
      if (!nextKeys.has(key)) {
        container.destroy();
        this.slotContainers.delete(key);
        this.hiddenSlots.delete(key);
      }
    });
    Array.from(this.lastStatLabels.keys()).forEach((key) => {
      if (!nextKeys.has(key)) {
        this.lastStatLabels.delete(key);
        this.animatingSlots.delete(key);
        this.statLabelNodes.delete(key);
      }
    });
  }

  createSlotSprite(slot: SlotViewModel, size: { w: number; h: number }) {
    const container = this.scene.add.container(0, 0);
    // No background frame; rely on card art only.
    const cardScale = slot.isRested ? this.config.slot.restedScale : this.config.slot.cardScale;
    const cardSize = this.computeCardSize(size.w, size.h, cardScale);
    const width = cardSize.w;
    const unitHeight = cardSize.h;
    const pilotHeight = cardSize.h;
    let unitCenterY = 0;
    const pilotCenterY = 0;

    const unitRatio = 1;
    let pilotOffsetY = pilotCenterY;
    if (slot.pilot && this.config.slot.showPilotInSlots) {
      const layout = this.getPilotLayout(unitHeight, pilotHeight);
      unitCenterY = layout.unitCenterY;
      pilotOffsetY = layout.pilotOffsetY;
      const pilotObj = this.drawCard(
        container,
        slot.pilot.textureKey,
        slot.pilot.id,
        width,
        pilotHeight,
        pilotOffsetY,
        false,
        true,
        this.config.slot.pilotSliceRatio,
      );
      pilotObj?.setAlpha(this.config.slot.pilotAlpha);
      this.drawUnitBorder(container, width, pilotHeight, pilotOffsetY, 1, false);
    }

    if (slot.unit) {
      const unitLayer = this.scene.add.container(0, 0);
      this.drawCard(unitLayer, slot.unit.textureKey, slot.unit.id, width, unitHeight, unitCenterY, true, false);
      this.drawUnitBorder(unitLayer, width, unitHeight, unitCenterY, unitRatio, false);
      container.add(unitLayer);
    }

    const ap = slot.fieldCardValue?.totalAP ?? slot.ap ?? 0;
    const hp = slot.fieldCardValue?.totalHP ?? slot.hp ?? 0;
    this.drawStatsBadge(container, 0, 0, cardSize.w, cardSize.h, ap, hp, 6);
    container.setAlpha(slot.isRested ? this.config.slot.restedAlpha : 1);
    container.setAngle(slot.isRested ? this.config.slot.restedAngle : 0);
    return container;
  }

  clear() {
    this.slotContainers.forEach((c) => c.destroy());
    this.slotContainers.clear();
    this.lastStatLabels.clear();
    this.animatingSlots.clear();
    this.statLabelNodes.clear();
    this.hidePreview();
  }

  destroy() {
    this.previewController.destroy();
    this.clear();
  }

  private drawSlot(
    container: Phaser.GameObjects.Container,
    slotSize: number,
    slotHeight: number,
    slot: SlotViewModel,
    isSelected: boolean,
  ) {
    const cardScale = slot.isRested ? this.config.slot.restedScale : this.config.slot.cardScale;
    const cardSize = this.computeCardSize(slotSize, slotHeight, cardScale);
    const width = cardSize.w;
    const unitHeight = cardSize.h;
    const pilotHeight = cardSize.h;
    let unitCenterY = 0;
    const pilotCenterY = 0;

    const unitRatio = 1;
    let pilotOffsetY = pilotCenterY;
    if (slot.pilot && this.config.slot.showPilotInSlots) {
      const layout = this.getPilotLayout(unitHeight, pilotHeight);
      unitCenterY = layout.unitCenterY;
      pilotOffsetY = layout.pilotOffsetY;
      const pilotObj = this.drawCard(
        container,
        slot.pilot.textureKey,
        slot.pilot.id,
        width,
        pilotHeight,
        pilotOffsetY,
        false, // cropFromTop
        true, // isPilot
        this.config.slot.pilotSliceRatio, // pilotSliceRatio
      );
      pilotObj?.setAlpha(0.95);
      this.drawUnitBorder(container, width, pilotHeight, pilotOffsetY, 1, isSelected);
    }

    if (slot.unit) {
      const unitLayer = this.scene.add.container(0, 0);
      this.drawCard(unitLayer, slot.unit.textureKey, slot.unit.id, width, unitHeight, unitCenterY, true, false);
      this.drawUnitBorder(unitLayer, width, unitHeight, unitCenterY, unitRatio, isSelected);
      container.add(unitLayer);
    }

    const ap = slot.fieldCardValue?.totalAP ?? slot.ap ?? 0;
    const hp = slot.fieldCardValue?.totalHP ?? slot.hp ?? 0;
    const slotKey = `${slot.owner}-${slot.slotId}`;
    this.drawStatsBadge(container, 0, 0, cardSize.w, cardSize.h, ap, hp, 6, slotKey);
  }

  private computeCardSize(slotW: number, slotH: number, cardScale: number) {
    const maxW = slotW * cardScale;
    const maxH = slotH * cardScale;
    return this.fitCardSize(maxW, maxH);
  }

  private getPilotLayout(unitHeight: number, pilotHeight: number) {
    const pilotVisibleH = pilotHeight * this.config.slot.pilotSliceRatio;
    // Center the combined stack: full unit + visible pilot slice below it.
    const unitCenterY = -pilotVisibleH / 2;
    // Place the pilot image so its visible bottom slice starts at the unit bottom.
    const pilotOffsetY = unitCenterY + unitHeight / 2 - pilotHeight / 2 + pilotVisibleH;
    return { unitCenterY, pilotOffsetY };
  }

  private drawCard(
    container: Phaser.GameObjects.Container,
    textureKey: string | undefined,
    fallbackLabel: string | undefined,
    w: number,
    h: number,
    offsetY: number,
    cropFromTop = false,
    isPilot = false,
    pilotSliceRatio = this.config.slot.pilotSliceRatio
  ) {
    const hasTexture = textureKey && this.scene.textures.exists(textureKey);
    const scale = isPilot ? pilotSliceRatio : 1;
    const fitted = this.fitCardSize(w * scale, h * scale);
    if (hasTexture && textureKey) {
      const img = this.scene.add.image(0, offsetY, textureKey).setOrigin(0.5);
      if (isPilot) {
        img.setDisplaySize(w, h);
        this.applySquareCrop(textureKey, img, cropFromTop, w, h, pilotSliceRatio);
      } else {
        img.setDisplaySize(fitted.w, fitted.h);
      }
      container.add(img);
      return img;
    }

    const card = this.drawHelpers.drawRoundedRect({
      x: 0,
      y: offsetY,
      width: fitted.w,
      height: fitted.h,
      radius: 8,
      fillColor: "#cbd3df",
      fillAlpha: 0.9,
      strokeColor: "#0f1118",
      strokeAlpha: 0.8,
      strokeWidth: 2,
    });
    container.add(card);
    if (fallbackLabel) {
      const label = this.scene.add
        .text(0, offsetY, fallbackLabel, {
          fontSize: "12px",
          fontFamily: "Arial",
          color: this.palette.ink,
          wordWrap: { width: fitted.w - 8 },
          align: "center",
        })
        .setOrigin(0.5);
      container.add(label);
      return label;
    }
    return card;
  }

  private fitCardSize(maxW: number, maxH: number) {
    let fitW = Math.min(maxW, maxH * this.cardAspect);
    let fitH = fitW / this.cardAspect;
    if (fitH > maxH) {
      fitH = maxH;
      fitW = fitH * this.cardAspect;
    }
    return { w: fitW, h: fitH };
  }

  private applySquareCrop(
    textureKey: string,
    img: Phaser.GameObjects.Image,
    cropFromTop: boolean,
    targetW: number,
    targetH: number,
    pilotSliceRatio: number,
  ) {
    const tex = this.scene.textures.get(textureKey);
    const source = tex.getSourceImage() as HTMLImageElement | HTMLCanvasElement | null;
    if (!source) return;
    const tw = (source as any).width ?? 0;
    const th = (source as any).height ?? 0;
    if (!tw || !th) return;
    const cropH = Math.min(th, (tw * targetH) / targetW);
    const cropW = tw;
    if (cropFromTop) {
      img.setCrop(0, 0, cropW, cropH);
      return;
    }
    const pilotH = Math.min(th * pilotSliceRatio, cropH);
    img.setCrop(0, th - pilotH, cropW, pilotH);
  }

  private drawUnitBorder(
    container: Phaser.GameObjects.Container,
    w: number,
    h: number,
    offsetY: number,
    ratio: number,
    isSelected: boolean,
  ) {
    //if (!isSelected) return;
    const graphics = this.scene.add.graphics();
    const color = isSelected ? this.config.slot.selectedBorderColor : this.config.slot.defaultBorderColor;
    const alpha = isSelected ? this.config.slot.selectedBorderAlpha : this.config.slot.defaultBorderAlpha;
    graphics.lineStyle(this.config.slot.borderStroke, color, 1);
    graphics.strokeRoundedRect(-w / 2, offsetY - h / 2, w, h * ratio, 2);
    graphics.setDepth(5);
    graphics.setAlpha(alpha);
    container.add(graphics);
  }

  private drawStatsBadge(
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    w: number,
    h: number,
    ap: number,
    hp: number,
    baseDepth: number,
    slotKey?: string,
  ) {
    const label = `${ap ?? 0}|${hp ?? 0}`;
    const badgeW = w * this.config.slot.statsBadge.wFactor;
    const badgeH = h * this.config.slot.statsBadge.hFactor;
    const badgeX = x + w * this.config.slot.statsBadge.xFactor - 4;
    const badgeY = y + h * this.config.slot.statsBadge.yFactor;
    const fontSize = Math.min(
      this.config.slot.statsBadge.fontMax,
      Math.max(this.config.slot.statsBadge.fontMin, Math.floor(h * 0.18)),
    );
    const textStyle = { fontSize: `${fontSize}px`, fontFamily: "Arial", fontStyle: "bold", color: "#ffffff" };
    const pill = this.drawHelpers.drawRoundedRect({
      x: badgeX,
      y: badgeY,
      width: badgeW + 5,
      height: badgeH,
      radius: 6,
      fillColor: 0x000000,
      fillAlpha: 1,
      strokeAlpha: 0,
      strokeWidth: 0,
    });
    pill.setDepth(baseDepth + 3);

    const statsText = this.scene.add
      .text(badgeX, badgeY, label, textStyle)
      .setOrigin(0.5)
      .setDepth(baseDepth + 4);
    container.add(pill);
    container.add(statsText);
    if (slotKey) {
      this.statLabelNodes.set(slotKey, { text: statsText, pill });
    }

    if (slotKey) {
      const score = (ap ?? 0) + (hp ?? 0);
      this.lastStatLabels.set(slotKey, { label, score });
    }
  }

  private triggerStatsPulse(
    statsText: Phaser.GameObjects.Text,
    pill: Phaser.GameObjects.GameObject,
    delta: number,
  ): Promise<void> {
    const tint = delta > 0 ? 0x4de685 : delta < 0 ? 0xff6b6b : 0xffffff;
    if (delta !== 0) {
      statsText.setTint(tint);
    }
    const tweenTargets: Phaser.GameObjects.GameObject[] = [statsText];
    if (pill instanceof Phaser.GameObjects.GameObject) {
      tweenTargets.push(pill);
    }
    const matrix = statsText.getWorldTransformMatrix();
    this.spawnStatSparks(matrix.tx, matrix.ty, tint);
    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: tweenTargets,
        scaleX: 1.2,
        scaleY: 1.2,
        duration: 220,
        ease: "Back.easeOut",
        yoyo: true,
        onComplete: () => {
          statsText.setTint(0xffffff);
          if (pill instanceof Phaser.GameObjects.GameObject && typeof (pill as any).setScale === "function") {
            (pill as any).setScale(1, 1);
          }
          resolve();
        },
      });
    });
  }

  private spawnStatSparks(x: number, y: number, color: number) {
    for (let i = 0; i < 4; i++) {
      const spark = this.scene.add.rectangle(x, y, 3, 10, color, 0.9).setDepth(1500).setOrigin(0.5);
      spark.rotation = Phaser.Math.FloatBetween(-0.4, 0.4);
      this.scene.tweens.add({
        targets: spark,
        x: x + Phaser.Math.Between(-14, 14),
        y: y + Phaser.Math.Between(-12, -30),
        alpha: 0,
        rotation: spark.rotation + Phaser.Math.FloatBetween(-0.5, 0.5),
        duration: 320,
        ease: "Cubic.easeOut",
        onComplete: () => spark.destroy(),
      });
    }
  }

  markStatAnimationPending(slotKey: string) {
    const previous = this.lastStatLabels.get(slotKey)?.label ?? null;
    this.animatingSlots.set(slotKey, previous);
  }

  releaseStatAnimation(slotKey: string) {
    this.animatingSlots.delete(slotKey);
  }

  playStatPulse(slotKey: string, delta: number) {
    if (!Number.isFinite(delta) || delta === 0) {
      return Promise.resolve();
    }
    // Ensure slot is visible before pulsing.
    const [owner, slotId] = slotKey.split("-");
    if (owner && slotId) {
      this.setSlotVisible(owner as SlotOwner, slotId, true);
    }
    return this.getStatNodesWithRetry(slotKey).then((nodes) => {
      if (!nodes) {
        return;
      }
      return this.triggerStatsPulse(nodes.text, nodes.pill, delta);
    });
  }

  private getStatNodesWithRetry(
    slotKey: string,
    maxAttempts = 8,
    delayMs = 16,
  ): Promise<{ text: Phaser.GameObjects.Text; pill: Phaser.GameObjects.GameObject } | null> {
    return new Promise((resolve) => {
      const attempt = (remaining: number) => {
        const nodes = this.statLabelNodes.get(slotKey);
        if (nodes) {
          resolve(nodes);
          return;
        }
        if (remaining <= 0) {
          resolve(null);
          return;
        }
        this.scene.time.delayedCall(delayMs, () => attempt(remaining - 1));
      };
      attempt(maxAttempts);
    });
  }

  private startPreviewTimer(slot: SlotViewModel) {
    const cardW = this.config.preview.cardWidth;
    const cardH = cardW * this.config.preview.cardAspect;
    this.previewController.start((container) => {
      renderSlotPreviewCard({
        scene: this.scene,
        drawHelpers: this.drawHelpers,
        container,
        slot,
        x: 0,
        y: 0,
        w: cardW,
        h: cardH,
        depthOffset: 0,
      });
    });
  }

  private handlePointerUp(slot?: SlotViewModel) {
    if (this.previewController.isActive()) return;
    this.previewController.cancelPending();
    if (slot) {
      if (this.slotClicksEnabled) {
        this.onSlotClick?.(slot);
      }
    }
  }

  private handlePointerOut() {
    if (this.previewController.isActive()) return;
    this.previewController.cancelPending();
  }

  private rerenderLast() {
    if (!this.lastPositions || !this.lastSlots.length) return;
    this.render(this.lastSlots, { positions: this.lastPositions });
  }

  private hidePreview(skipTween = false) {
    this.previewController.hide(skipTween);
  }

  private animateCardEntry(
    slot: SlotViewModel,
    pos: { x: number; y: number; isOpponent: boolean },
    incomingCard?: SlotCardView,
    startOverride?: { x: number; y: number; isOpponent?: boolean },
  ) {
    const isOpponent = startOverride?.isOpponent ?? slot.owner === "opponent";
    const cam = this.scene.cameras.main;
    const start = startOverride ?? {
      x: cam.centerX,
      y: isOpponent ? cam.height * 0.12 : cam.height - 60,
    };
    const card = incomingCard || slot.unit || slot.pilot;
    const cardName = (card as any)?.cardData?.name || card?.id;
    const stats = {
      ap: slot.fieldCardValue?.totalAP ?? slot.ap ?? 0,
      hp: slot.fieldCardValue?.totalHP ?? slot.hp ?? 0,
    };
    
    this.playAnimator.play({
      textureKey: card?.textureKey,
      fallbackLabel: card?.id,
      start,
      end: { x: pos.x, y: pos.y },
      isOpponent,
      cardName,
      stats,
    });
  }

  private isCommandCard(card?: SlotCardView) {
    return (card?.cardType || card?.cardData?.cardType || "").toLowerCase() === "command";
  }

}
