import Phaser from "phaser";
import { BASE_H, BASE_W, INTERNAL_W } from "../../config/gameLayout";
import { DrawHelpers } from "./HeaderHandler";
import { Palette } from "./types";

export class ActionButtonBarHandler {
  private barHeight = 40;
  private barPadding = 16;
  private barWidth = INTERNAL_W - this.barPadding * 2;
  private buttons = Array.from({ length: 10 }, (_, i) => `Action ${i + 1}`);
  private hitAreas: Phaser.GameObjects.Rectangle[] = [];
  private elements: Phaser.GameObjects.GameObject[] = [];
  private onAction: (index: number) => void = () => {};
  private scrollOffset = 0;
  private maxScroll = 0;
  private scrollArea?: Phaser.GameObjects.Rectangle;
  private wheelListener?: (pointer: Phaser.Input.Pointer, dx: number, dy: number, dz: number) => void;
  private lastOffset: { x: number; y: number } = { x: 0, y: 0 };
  private maskGraphics?: Phaser.GameObjects.Graphics;
  private mask?: Phaser.Display.Masks.GeometryMask;
  private isDragging = false;
  private dragStartX = 0;
  private dragStartOffset = 0;
  private dragPointerId: number | null = null;
  private dragMoved = false;
  private barBounds = { left: 0, right: 0, top: 0, bottom: 0 };
  private pointerDownListener?: (pointer: Phaser.Input.Pointer) => void;
  private pointerMoveListener?: (pointer: Phaser.Input.Pointer) => void;
  private pointerUpListener?: (pointer: Phaser.Input.Pointer) => void;

  // These mirror HandAreaHandler layout so the bar can sit just above the hand.
  private handLayout = { cardH: 90, gap: 8, rows: 2, bottomPadding: 24 };

  constructor(private scene: Phaser.Scene, private palette: Palette, private drawHelpers: DrawHelpers) {}

  setActionHandler(handler: (index: number) => void) {
    this.onAction = handler;
  }

  draw(offset: { x: number; y: number }) {
    this.lastOffset = offset;
    this.elements.forEach((e) => e.destroy());
    this.elements = [];
    this.hitAreas.forEach((h) => h.destroy());
    this.hitAreas = [];
    this.scrollArea?.destroy();
    this.scrollArea = undefined;
    this.maskGraphics?.destroy();
    this.maskGraphics = undefined;
    this.mask?.destroy?.();
    this.mask = undefined;

    const barWidth = this.barWidth;

    // Compute hand top using HandAreaHandler's layout to avoid overlap.
    const { cardH, gap, rows, bottomPadding } = this.handLayout;
    const totalHandHeight = rows * cardH + (rows - 1) * gap;
    const handTop = BASE_H - bottomPadding - totalHandHeight + offset.y;

    const barY = handTop - this.barHeight / 2 - 12; // small gap above hand
    // Center bar against the full board width while using internal width for sizing.
    const barX = BASE_W / 2 + offset.x;

    const btnCount = this.buttons.length;
    const btnGap = 12;
    const btnWidth = Math.min(120, (barWidth - (btnCount - 1) * btnGap) / Math.min(btnCount, 5));
    const btnHeight = this.barHeight - 12;
    const contentWidth = btnCount * btnWidth + (btnCount - 1) * btnGap;
    this.maxScroll = Math.max(0, contentWidth - barWidth);
    this.scrollOffset = Phaser.Math.Clamp(this.scrollOffset, 0, this.maxScroll);

    this.barBounds = {
      left: barX - barWidth / 2,
      right: barX + barWidth / 2,
      top: barY - btnHeight / 2,
      bottom: barY + btnHeight / 2,
    };

    // Mask to clip horizontal scroll content.
    this.maskGraphics = this.scene.add.graphics();
    this.maskGraphics.fillStyle(0xffffff, 0.0001); // nearly transparent; only needed for mask
    this.maskGraphics.fillRect(barX - barWidth / 2, barY - btnHeight / 2, barWidth, btnHeight);
    this.mask = this.maskGraphics.createGeometryMask();

    const startX = barX - barWidth / 2 + btnWidth / 2 - this.scrollOffset;
    for (let i = 0; i < btnCount; i++) {
      const x = startX + i * (btnWidth + btnGap);
      const y = barY;
      const rect = this.drawHelpers.drawRoundedRect({
        x,
        y,
        width: btnWidth,
        height: btnHeight,
        radius: 6,
        fillColor: "#5e48f0",
        fillAlpha: 1,
        strokeColor: 0x5e48f0,
        strokeAlpha: 0,
        strokeWidth: 0,
      }).setDepth(900);
      rect.setMask(this.mask || null);
      this.elements.push(rect);

      const label = this.scene.add
        .text(x, y, this.buttons[i], {
          fontSize: "14px",
          fontFamily: "Arial",
          color: "#ffffff",
        })
        .setOrigin(0.5)
        .setDepth(901);
      label.setMask(this.mask || null);
      this.elements.push(label);

      const hit = this.scene.add
        .rectangle(x, y, btnWidth, btnHeight, 0x000000, 0)
        .setInteractive({ useHandCursor: true })
        .setDepth(902);
      hit.on("pointerup", (pointer: Phaser.Input.Pointer) => {
        const isDragPointer = this.dragPointerId === pointer.id;
        if (isDragPointer && this.dragMoved) return;
        this.onAction(i);
      });
      this.hitAreas.push(hit);
      hit.setMask(this.mask || null);
      this.elements.push(hit);
    }

    // Transparent area to capture wheel scrolling for horizontal scroll.
    this.scrollArea = this.scene.add
      .rectangle(barX, barY, barWidth, btnHeight, 0x000000, 0)
      .setInteractive({ useHandCursor: false })
      .setDepth(850);

    if (!this.wheelListener) {
      this.wheelListener = (pointer, _dx, dy) => {
        if (!this.scrollArea) return;
        const bounds = this.scrollArea.getBounds();
        if (pointer.x < bounds.left || pointer.x > bounds.right || pointer.y < bounds.top || pointer.y > bounds.bottom) {
          return;
        }
        // Positive dy scrolls down; treat as moving right.
        this.scrollOffset = Phaser.Math.Clamp(this.scrollOffset + dy * 0.5, 0, this.maxScroll);
        this.draw(this.lastOffset);
      };
      this.scene.input.on("wheel", this.wheelListener);
    }

    // Global pointer listeners for drag scrolling (touch friendly).
    if (!this.pointerDownListener) {
      this.pointerDownListener = (pointer) => {
        const { x, y } = pointer;
        if (x >= this.barBounds.left && x <= this.barBounds.right && y >= this.barBounds.top && y <= this.barBounds.bottom) {
          this.isDragging = true;
          this.dragMoved = false;
          this.dragPointerId = pointer.id;
          this.dragStartX = x;
          this.dragStartOffset = this.scrollOffset;
        }
      };
      this.scene.input.on("pointerdown", this.pointerDownListener);
    }

    if (!this.pointerMoveListener) {
      this.pointerMoveListener = (pointer) => {
        if (!this.isDragging || this.dragPointerId !== pointer.id) return;
        const delta = pointer.x - this.dragStartX;
        if (Math.abs(delta) > 3) this.dragMoved = true;
        this.scrollOffset = Phaser.Math.Clamp(this.dragStartOffset - delta, 0, this.maxScroll);
        this.draw(this.lastOffset);
      };
      this.scene.input.on("pointermove", this.pointerMoveListener);
    }

    if (!this.pointerUpListener) {
      this.pointerUpListener = (pointer) => {
        if (this.dragPointerId !== null && pointer.id !== this.dragPointerId) return;
        this.isDragging = false;
        this.dragPointerId = null;
        this.dragMoved = false;
      };
      this.scene.input.on("pointerup", this.pointerUpListener);
      this.scene.input.on("pointerupoutside", this.pointerUpListener);
      this.scene.input.on("pointerout", this.pointerUpListener);
    }
  }
}
