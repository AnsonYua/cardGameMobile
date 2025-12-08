import Phaser from "phaser";
import { DrawHelpers } from "./HeaderHandler";
import { Palette } from "./types";
import { SlotPositionMap, SlotViewModel } from "./SlotTypes";

type RenderOptions = {
  positions: SlotPositionMap;
};

export class SlotDisplayHandler {
  private slotContainers = new Map<string, Phaser.GameObjects.Container>();
  private previewContainer?: Phaser.GameObjects.Container;
  private previewTimer?: any;
  private previewActive = false;

  constructor(private scene: Phaser.Scene, private palette: Palette, private drawHelpers: DrawHelpers) {}

  render(slots: SlotViewModel[], { positions }: RenderOptions) {
    const nextKeys = new Set<string>();
    slots.forEach((slot) => {
      const pos = positions[slot.owner]?.[slot.slotId];
      if (!pos) return;
      const key = `${slot.owner}-${slot.slotId}`;
      nextKeys.add(key);
      this.slotContainers.get(key)?.destroy();

      const container = this.scene.add.container(pos.x, pos.y);
      container.setDepth(pos.isOpponent ? 30 : 40);
      container.setSize(pos.w, pos.h);
      container.setInteractive({ useHandCursor: false });
      container.on("pointerdown", () => this.startPreviewTimer(slot));
      container.on("pointerup", () => this.handlePointerUp());
      container.on("pointerout", () => this.handlePointerOut());

      if (slot.unit || slot.pilot) {
        this.drawFrame(container, pos.w, pos.h);
      }
      this.drawSlot(container, pos.w, pos.h, slot);
      container.setAlpha(slot.isRested ? 0.75 : 1);

      this.slotContainers.set(key, container);
    });

    Array.from(this.slotContainers.entries()).forEach(([key, container]) => {
      if (!nextKeys.has(key)) {
        container.destroy();
        this.slotContainers.delete(key);
      }
    });
  }

  clear() {
    this.slotContainers.forEach((c) => c.destroy());
    this.slotContainers.clear();
    this.hidePreview();
  }

  private drawSlot(container: Phaser.GameObjects.Container, slotSize: number, slotHeight: number, slot: SlotViewModel) {
    const cardSize = this.computeCardSize(slotSize, slotHeight);
    const width = cardSize.w;
    const unitHeight = slotSize * 0.9;
    const pilotHeight = slotSize * 0.9;
    const unitCenterY = 0;
    const pilotCenterY = 0;

    let unitRatio = 1;
    let pilotRatio = 0;
    if (slot.pilot) {
      unitRatio = 0.75;
      pilotRatio = 1 - unitRatio;
    }
    if (slot.unit) {
      const unitLayer = this.scene.add.container(0, 0);
      this.drawCard(unitLayer, slot.unit.textureKey, slot.unit.id, width, unitHeight, unitCenterY, true, false);
      this.drawUnitBorder(unitLayer, width, unitHeight, unitCenterY, unitRatio);
      container.add(unitLayer);
    }

    if (slot.pilot) {
      const pilotObj = this.drawCard(
        container,
        slot.pilot.textureKey,
        slot.pilot.id,
        width,
        pilotHeight,
        pilotCenterY,
        false, // cropFromTop
        true, // isPilot
        pilotRatio, // pilotSliceRatio
      );
      pilotObj?.setAlpha(0.95);
      this.drawUnitBorder(container, width, pilotHeight, pilotHeight *(1-pilotRatio) , pilotRatio);
    }

    const ap = slot.fieldCardValue?.totalAP ?? slot.ap ?? 0;
    const hp = slot.fieldCardValue?.totalHP ?? slot.hp ?? 0;
    this.drawStatsBadge(container, 0, 0, cardSize.w, cardSize.h, ap, hp, 6);
  }

  private computeCardSize(slotW: number, slotH: number) {
    const base = Math.min(slotW, slotH) * 0.8;
    return { w: base, h: base };
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
    pilotSliceRatio = 0.4
  ) {
    const hasTexture = textureKey && this.scene.textures.exists(textureKey);
    if (hasTexture && textureKey) {
      const img = this.scene.add.image(0, offsetY, textureKey).setDisplaySize(w, h).setOrigin(0.5);
      if(isPilot){
        this.applySquareCrop(textureKey, img, cropFromTop, w, h, isPilot, pilotSliceRatio);
      }
      container.add(img);
      return img;
    }

    const card = this.drawHelpers.drawRoundedRect({
      x: 0,
      y: offsetY,
      width: w,
      height: h,
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
          wordWrap: { width: w - 8 },
          align: "center",
        })
        .setOrigin(0.5);
      container.add(label);
      return label;
    }
    return card;
  }

  private applySquareCrop(
    textureKey: string,
    img: Phaser.GameObjects.Image,
    cropFromTop: boolean,
    targetW: number,
    targetH: number,
    isPilot: boolean,
    pilotSliceRatio: number
  ) {
    const tex = this.scene.textures.get(textureKey);
    const source = tex.getSourceImage() as HTMLImageElement | HTMLCanvasElement | null;
    if (!source) return;
    const tw = (source as any).width ?? 0;
    const th = (source as any).height ?? 0;
    if (!tw || !th) return;
    // Keep your height formula but clamp to the source to avoid overrun.
    const cropH = Math.min(th, (tw * targetH) / targetW);
    const cropW = tw;
    if (cropFromTop) {
      img.setCrop(0, 0, cropW, cropH);
    } else if (isPilot) {
      // Pilot shows the lower slice (ratio of source), preserving your intent.
      const pilotH = Math.min(th * pilotSliceRatio, cropH);
      img.setCrop(0, th - pilotH, cropW, pilotH);
    } else {
      // Default: center crop using the computed height.
      const cropY = Math.max(0, (th - cropH) / 2);
      img.setCrop(0, cropY, cropW, cropH);
    }
  }

  private drawFrame(container: Phaser.GameObjects.Container, slotW: number, slotH: number) {
    const w = slotW * 0.86;
    const h = slotH * 0.86;
    const shadow = this.drawHelpers.drawRoundedRect({
      x: 3,
      y: 3,
      width: w + 14,
      height: h + 14,
      radius: 16,
      fillColor: "#000000",
      fillAlpha: 0.35,
      strokeWidth: 0,
    });
    const outer = this.drawHelpers.drawRoundedRect({
      x: 0,
      y: 0,
      width: w + 12,
      height: h + 12,
      radius: 15,
      fillColor: "#111926",
      fillAlpha: 1,
      strokeColor: "#0a0d14",
      strokeAlpha: 0.9,
      strokeWidth: 2.2,
    });
    const mid = this.drawHelpers.drawRoundedRect({
      x: 0,
      y: 0,
      width: w + 8,
      height: h + 8,
      radius: 13,
      fillColor: "#2f3a4c",
      fillAlpha: 0.85,
      strokeColor: "#4b5668",
      strokeAlpha: 0.7,
      strokeWidth: 2,
    });
    const inner = this.drawHelpers.drawRoundedRect({
      x: 0,
      y: 0,
      width: w + 4,
      height: h + 4,
      radius: 11,
      fillColor: "#0f1118",
      fillAlpha: 0.9,
      strokeColor: "#1c2330",
      strokeAlpha: 0.7,
      strokeWidth: 1.4,
    });
    container.add(shadow);
    container.add(outer);
    container.add(mid);
    container.add(inner);
  }

  private drawUnitBorder(container: Phaser.GameObjects.Container, w: number, h: number, offsetY: number, ratio :number) {
    const graphics = this.scene.add.graphics();
    graphics.lineStyle(3, 0xffffff, 1);
    graphics.strokeRoundedRect(-w / 2, offsetY - h / 2, w, h * ratio, 2);
    graphics.setDepth(5);
    graphics.setAlpha(0.75);
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
  ) {
    const label = `${ap ?? 0}|${hp ?? 0}`;
    const badgeW = w * 0.4;
    const badgeH = h * 0.3;
    const badgeX = x + w * 0.34 - 4;
    const badgeY = y + h * 0.36;
    const fontSize = Math.min(16, Math.max(12, Math.floor(h * 0.18)));
    const textStyle = { fontSize: `${fontSize}px`, fontFamily: "Arial", fontStyle: "bold", color: "#ffffff" };
    const pill = this.drawHelpers.drawRoundedRect({
      x: badgeX,
      y: badgeY,
      width: badgeW + 5,
      height: badgeH,
      radius: 6,
      fillColor: 0x000000,
      fillAlpha: 0.9,
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
  }

  private startPreviewTimer(slot: SlotViewModel) {
    this.hidePreview();
    this.previewTimer = setTimeout(() => {
      this.previewTimer = undefined;
      this.showPreview(slot);
    }, 400);
  }

  private handlePointerUp() {
    if (this.previewActive) return;
    this.cancelPreviewTimer();
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

  private showPreview(slot: SlotViewModel) {
    this.hidePreview(true);
    const cam = this.scene.cameras.main;
    const cx = cam.centerX;
    const cy = cam.centerY;
    const pad = 12;
    const cardW = 300;
    const cardH = cardW * 88/64;
    const depth = 1000;
    const container = this.scene.add.container(cx, cy).setDepth(depth).setAlpha(0);

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x000000, 0.65);
    bg.fillRect(-cam.width / 2, -cam.height / 2, cam.width, cam.height);
    bg.setInteractive(new Phaser.Geom.Rectangle(-cam.width / 2, -cam.height / 2, cam.width, cam.height), Phaser.Geom.Rectangle.Contains);
    bg.on("pointerdown", () => this.hidePreview());
    container.add(bg);

    if (slot.unit && !slot.pilot) {
      this.drawPreviewCard(container, 0, 0, cardW, cardH, slot.unit, slot.fieldCardValue);
    } else if (slot.unit && slot.pilot) {
      const pilotOffsetY = cardH * 0.12;
      this.drawPreviewCard(container, -pad, pilotOffsetY, cardW * 0.85, cardH * 0.85, slot.pilot, undefined, true, depth);
      this.drawPreviewCard(container, pad, -pilotOffsetY * 0.4, cardW, cardH, slot.unit, slot.fieldCardValue, false, depth + 1);
    }

    this.previewContainer = container;
    this.previewActive = true;
    this.scene.tweens.add({
      targets: container,
      alpha: 1,
      duration: 180,
      ease: "Quad.easeOut",
    });
  }

  private hidePreview(skipTween = false) {
    this.cancelPreviewTimer();
    if (this.previewContainer) {
      const target = this.previewContainer;
      this.previewContainer = undefined;
      if (skipTween) {
        target.destroy();
      } else {
        this.scene.tweens.add({
          targets: target,
          alpha: 0,
          duration: 150,
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
    card: SlotCardView,
    field?: { totalAP?: number; totalHP?: number },
    isPilot = false,
    depthOffset = 0,
  ) {
    const texKey = card.textureKey;
    const hasTex = texKey && this.scene.textures.exists(texKey);
    let img: Phaser.GameObjects.Image | Phaser.GameObjects.Graphics;
    if (hasTex && texKey) {
      img = this.scene.add.image(x, y, texKey).setDisplaySize(w, h).setOrigin(0.5);
    } else {
      img = this.drawHelpers.drawRoundedRect({
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
    }
    img.setDepth(depthOffset + 1);
    container.add(img);

    const inAp = card.cardData?.ap ?? 0;
    const inHp = card.cardData?.hp ?? 0;
    const insideLabel = `${inAp}|${inHp}`;
    this.drawPreviewBadge(container, x + w * 0.34 - 4, y + h * 0.36, w, h, insideLabel, depthOffset + 2);

    if (field) {
      const outAp = field.totalAP ?? 0;
      const outHp = field.totalHP ?? 0;
      this.drawPreviewBadge(container, x + w * 0.34 - 4, y + h * 0.55, w, h, `${outAp}|${outHp}`, depthOffset + 2);
    }

    if (isPilot) {
      // Pilot badge already drawn; total badge handled by the unit layer.
    }
  }

  private drawPreviewBadge(
    container: Phaser.GameObjects.Container,
    badgeX: number,
    badgeY: number,
    w: number,
    h: number,
    label: string,
    baseDepth: number,
  ) {
    const badgeW = w * 0.5;
    const badgeH = h * 0.3;
    const fontSize = Math.min(16, Math.max(12, Math.floor(h * 0.18)));
    const textStyle = { fontSize: `${fontSize}px`, fontFamily: "Arial", fontStyle: "bold", color: "#ffffff" };
    const pill = this.drawHelpers.drawRoundedRect({
      x: badgeX,
      y: badgeY,
      width: badgeW + 5,
      height: badgeH,
      radius: 6,
      fillColor: 0x000000,
      fillAlpha: 0.9,
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
  }
}
