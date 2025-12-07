import Phaser from "phaser";
import { HAND_CARD_ASPECT } from "../../config/gameLayout";
import { DrawHelpers } from "./HeaderHandler";
import { Palette } from "./types";
import { SlotPositionMap, SlotViewModel } from "./SlotTypes";

type RenderOptions = {
  positions: SlotPositionMap;
};

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
      this.drawSlot(container, pos.w, pos.h, slot);
      if (slot.isRested) {
        container.setAlpha(0.75);
      } else {
        container.setAlpha(1);
      }
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
    this.slotContainers.forEach((container) => container.destroy());
    this.slotContainers.clear();
  }

  private drawSlot(container: Phaser.GameObjects.Container, slotSize: number, slotHeight: number, slot: SlotViewModel) {
    const cardSize = this.computeCardSize(slotSize, slotHeight);
    const pilotOffset = cardSize.h * 0.12;
    const pilotScale = 0.94;
    if (slot.pilot) {
      this.drawCard(container, slot.pilot.textureKey, slot.pilot.id, cardSize.w * pilotScale, cardSize.h * pilotScale, pilotOffset);
    }
    if (slot.unit) {
      this.drawCard(container, slot.unit.textureKey, slot.unit.id, cardSize.w, cardSize.h, 0);
    }
  }

  private computeCardSize(slotW: number, slotH: number) {
    const maxH = slotH * 0.92;
    const maxW = slotW * 0.7;
    let h = Math.min(maxH, maxW * HAND_CARD_ASPECT);
    let w = h / HAND_CARD_ASPECT;
    if (w > maxW) {
      w = maxW;
      h = w * HAND_CARD_ASPECT;
    }
    return { w, h };
  }

  private drawCard(
    container: Phaser.GameObjects.Container,
    textureKey: string | undefined,
    fallbackLabel: string | undefined,
    w: number,
    h: number,
    offsetY: number,
  ) {
    const hasTexture = textureKey && this.scene.textures.exists(textureKey);
    if (hasTexture && textureKey) {
      const img = this.scene.add.image(0, offsetY, textureKey).setDisplaySize(w, h).setOrigin(0.5);
      container.add(img);
      return;
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
    }
  }
}
