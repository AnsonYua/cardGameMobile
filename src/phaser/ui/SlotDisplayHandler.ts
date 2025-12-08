import Phaser from "phaser";
import { DrawHelpers } from "./HeaderHandler";
import { Palette } from "./types";
import { SlotPositionMap, SlotViewModel, SlotCardView } from "./SlotTypes";
import { drawPreviewBadge } from "./PreviewBadge";

type RenderOptions = {
  positions: SlotPositionMap;
};

export class SlotDisplayHandler {
  private slotContainers = new Map<string, Phaser.GameObjects.Container>();
  private previewContainer?: Phaser.GameObjects.Container;
  private previewTimer?: any;
  private previewActive = false;
  // Centralized tuning knobs so visuals stay consistent without hunting magic numbers.
  private config = {
    slot: {
      cardScale: 0.8,
      frameScale: 0.86,
      frameShadowOffset: 3,
      borderStroke: 3,
      pilotSliceRatio: 0.4,
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
    preview: {
      badgeSize: { w: 70, h: 45 },
      badgeFontSize: 20,
      totalBadgeColor: 0x284cfc,
      totalBadgeGap: 10,
      pilotOffsetRatio: 0.2,
      pilotCommandOffsetRatio: 0.1,
      pilotCommandLift: 65,
      unitYOffsetFactor: -0.4,
      cardWidth: 300,
      cardAspect: 88 / 64,
      overlayAlpha: 0.65,
      fadeIn: 180,
      fadeOut: 150,
      holdDelay: 400,
    },
  };
  private previewBadgeSize = this.config.preview.badgeSize;

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
    const base = Math.min(slotW, slotH) * this.config.slot.cardScale;
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
    pilotSliceRatio = this.config.slot.pilotSliceRatio
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
    const w = slotW * this.config.slot.frameScale;
    const h = slotH * this.config.slot.frameScale;
    const shadow = this.drawHelpers.drawRoundedRect({
      x: this.config.slot.frameShadowOffset,
      y: this.config.slot.frameShadowOffset,
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
    graphics.lineStyle(this.config.slot.borderStroke, 0xffffff, 1);
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
  }

  private startPreviewTimer(slot: SlotViewModel) {
    this.hidePreview();
    this.previewTimer = setTimeout(() => {
      this.previewTimer = undefined;
      this.showPreview(slot);
    }, this.config.preview.holdDelay);
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
    const cardW = this.config.preview.cardWidth;
    const cardH = cardW * this.config.preview.cardAspect;
    const depth = 1000;
    const container = this.scene.add.container(cx, cy).setDepth(depth).setAlpha(0);

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x000000, this.config.preview.overlayAlpha);
    bg.fillRect(-cam.width / 2, -cam.height / 2, cam.width, cam.height);
    bg.setInteractive(new Phaser.Geom.Rectangle(-cam.width / 2, -cam.height / 2, cam.width, cam.height), Phaser.Geom.Rectangle.Contains);
    bg.on("pointerdown", () => this.hidePreview());
    container.add(bg);
    /*
    it should call drawPreviewCard
     all slot data will put to it , 
     it will have logic
        if (ispliot){
          draw pilot and draw black label 
        }
        if (istunit){
          draw unit and draw black label 
        }
        draw black label for fieldValue
    */
    this.drawPreviewCard(container, 0, 0, cardW, cardH, slot, depth);

    this.previewContainer = container;
    this.previewActive = true;
    this.scene.tweens.add({
      targets: container,
      alpha: 1,
      duration: this.config.preview.fadeIn,
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
          duration: this.config.preview.fadeOut,
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
    slot: SlotViewModel,
    depthOffset = 0,
  ) {
    // Pilot sits slightly lower; unit sits slightly higher. Both share the same base size and are centered.
    let pilotOffsetY = h * this.config.preview.pilotOffsetRatio;
    const pilotScale = 1;

    let slotCardEnd = -1;

    if (slot.pilot) {
      if(slot.pilot.cardType == "command"){
        pilotOffsetY = h * this.config.preview.pilotCommandOffsetRatio;
      }
      const pW = w * pilotScale;
      const pH = h * pilotScale;
      const pilotTex = this.toTextureKey(slot.pilot);
      const pilotImg =
        pilotTex && this.scene.textures.exists(pilotTex)
          ? this.scene.add.image(x, y + pilotOffsetY, pilotTex).setDisplaySize(pW, pH).setOrigin(0.5)
          : this.drawHelpers.drawRoundedRect({
              x: x,
              y: y + pilotOffsetY,
              width: pW,
              height: pH,
              radius: 12,
              fillColor: "#cbd3df",
              fillAlpha: 1,
              strokeColor: "#0f1118",
              strokeAlpha: 0.8,
              strokeWidth: 2,
            });
      pilotImg.setDepth(depthOffset + 1);
      container.add(pilotImg);

      const pilotLabel = this.getPilotBadgeLabel(slot.pilot);

      let positionofPilotLabel = (y  + pilotOffsetY) + h/2 - this.previewBadgeSize.h/2 
      if(slot.pilot.cardType != "command"){
        positionofPilotLabel = (y  + pilotOffsetY) + h/2 - this.previewBadgeSize.h/2 - this.config.preview.pilotCommandLift
      }
      this.drawPreviewBadge(
        container,
        x  + w/2 - this.previewBadgeSize.w/2 ,
        positionofPilotLabel ,
        this.previewBadgeSize.w,
        this.previewBadgeSize.h,
        pilotLabel,
        depthOffset + 2,
      );
      slotCardEnd = positionofPilotLabel;
      if(slot.pilot.cardType != "command"){
        slotCardEnd =  slotCardEnd+ this.config.preview.pilotCommandLift
      }
    }

    if (slot.unit) {
      const unitTex = this.toTextureKey(slot.unit);
      const unitImg =
        unitTex && this.scene.textures.exists(unitTex)
          ? this.scene.add.image(x, y + pilotOffsetY * this.config.preview.unitYOffsetFactor, unitTex).setDisplaySize(w, h).setOrigin(0.5)
          : this.drawHelpers.drawRoundedRect({
              x: x,
              y: y + pilotOffsetY * this.config.preview.unitYOffsetFactor,
              width: w,
              height: h,
              radius: 12,
              fillColor: "#cbd3df",
              fillAlpha: 0.9,
              strokeColor: "#0f1118",
              strokeAlpha: 0.8,
              strokeWidth: 2,
            });
      unitImg.setDepth(depthOffset + 2);
      container.add(unitImg);

      const unitLabel = this.getUnitBadgeLabel(slot.unit);
      this.drawPreviewBadge(
        container,
        x + w / 2 - this.previewBadgeSize.w / 2,
        y - pilotOffsetY * 0.4 + h / 2 - this.previewBadgeSize.h / 2,
        // keep center alignment; offsets driven by pilotOffsetY factor
        this.previewBadgeSize.w,
        this.previewBadgeSize.h,
        unitLabel,
        depthOffset + 3,
      );
      if(slotCardEnd == -1){
        slotCardEnd = y + pilotOffsetY * this.config.preview.unitYOffsetFactor + h / 2 - this.previewBadgeSize.h / 2;
      }

      const field = slot.fieldCardValue;
      
      if (field) {
        const outAp = field.totalAP ?? 0;
        const outHp = field.totalHP ?? 0;
        this.drawPreviewBadge(
          container,
          x  + w/2 - this.previewBadgeSize.w/2,
          slotCardEnd + this.previewBadgeSize.h + this.config.preview.totalBadgeGap ,
          this.previewBadgeSize.w,
          this.previewBadgeSize.h,
          `${outAp}|${outHp}`,
          depthOffset + 3,
          this.config.preview.totalBadgeColor,
        );
      }
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
    fillColor: number = 0x000000,
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
      fillAlpha: 1,
      radius: 6,
      widthPad: 5,
      depthPillOffset: 3,
      depthTextOffset: 4,
      textStyle: {
        fontSize: `${this.config.preview.badgeFontSize}px`,
        fontFamily: "Arial",
        fontStyle: "bold",
        color: "#ffffff",
      },
    });
  }

  private toTextureKey(card?: SlotCardView) {
    if (!card?.textureKey) return undefined;
    return card.textureKey.replaceAll("-preview", "");
  }

  private getUnitBadgeLabel(card: SlotCardView) {
    const ap = card.cardData?.ap ?? 0;
    const hp = card.cardData?.hp ?? 0;
    return `${ap}|${hp}`;
  }

  private getPilotBadgeLabel(card: SlotCardView) {
    const type = (card.cardType || card.cardData?.cardType || "").toLowerCase();
    if (type === "command") {
      const rules: any[] = card.cardData?.effects?.rules || [];
      const pilotRule = rules.find((r) => r?.effectId === "pilot_designation" || r?.effectId === "pilotDesignation");
      const ap = pilotRule?.parameters?.AP ?? pilotRule?.parameters?.ap ?? 0;
      const hp = pilotRule?.parameters?.HP ?? pilotRule?.parameters?.hp ?? 0;
      return `${ap}|${hp}`;
    }
    const ap = card.cardData?.ap ?? 0;
    const hp = card.cardData?.hp ?? 0;
    return `${ap}|${hp}`;
  }
}
