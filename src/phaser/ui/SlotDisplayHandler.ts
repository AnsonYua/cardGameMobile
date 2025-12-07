import Phaser from "phaser";
import { DrawHelpers } from "./HeaderHandler";
import { Palette } from "./types";
import { SlotPositionMap, SlotViewModel } from "./SlotTypes";

type RenderOptions = {
  positions: SlotPositionMap;
};

/**
 * Renders unit/pilot stacks inside field slots.
 * When both exist, the square is split vertically: unit takes top 3/4 (cropped from top), pilot bottom 1/4 (cropped from bottom),
 * with a thin divider and a beveled frame behind.
 */
export class SlotDisplayHandler {
  private slotContainers = new Map<string, Phaser.GameObjects.Container>();

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

      if (slot.unit || slot.pilot) {
        this.drawFrame(container, pos.w, pos.h);
      }
      console.log("slot width and height ", pos.w , " ",pos.h)
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
  }

  private drawSlot(container: Phaser.GameObjects.Container, slotSize: number, slotHeight: number, slot: SlotViewModel) {
    const cardSize = this.computeCardSize(slotSize, slotHeight);
    const width = cardSize.w;
    const unitHeight = slotSize*0.9;
    const pilotHeight = slotSize*0.9;
    const unitCenterY = 0; // top 
    const pilotCenterY = 0; // bottom half

    let unitRatio = 1;
    let pilotRatio = 0;
    if (slot.pilot) {
      unitRatio = 0.75
      pilotRatio = 1 - unitRatio;
    }
    if (slot.unit) {
      const unitLayer = this.scene.add.container(0, 0);
      this.drawCard(unitLayer, slot.unit.textureKey, slot.unit.id, width, unitHeight, unitCenterY, true, false);
      this.drawUnitBorder(unitLayer, width, unitHeight, unitCenterY,unitRatio);
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
      fillAlpha: 0.95,
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
    graphics.lineStyle(3, 0x32a852, 1);
    graphics.strokeRoundedRect(-w / 2, offsetY - h / 2, w, h *ratio, 0);
    graphics.setDepth(5);
    container.add(graphics);
  }
}
