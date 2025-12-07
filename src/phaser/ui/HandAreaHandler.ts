import Phaser from "phaser";
import { BASE_H ,INTERNAL_W} from "../../config/gameLayout";
import { DrawHelpers } from "./HeaderHandler";
import { Offset, Palette } from "./types";
import type { HandCardView } from "./HandTypes";

export class HandAreaHandler {
  private handCards: HandCardView[] = [];
  private lastOffset: Offset = { x: 0, y: 0 };
  private drawnObjects: Phaser.GameObjects.GameObject[] = [];

  constructor(private scene: Phaser.Scene, private palette: Palette, private drawHelpers: DrawHelpers) {}

  draw(offset: Offset) {
    this.lastOffset = offset;
    this.clear();

    const maxPerRow = 6;
    const totalCards = this.handCards.length;
    const counts = [Math.min(maxPerRow, totalCards), Math.max(totalCards - maxPerRow, 0)].filter((c) => c > 0);
    const gapX = 8;
    const gapY = 10;
    const paddingX = 5;
    const targetCardW = 80;
    const aspect = 90 / 60; // maintain ratio
    const areaHeight = 240; // hand area height

    if (counts.length === 0) return;

    const maxCountPerRow = Math.max(...counts, 1);
    const availableWidth = INTERNAL_W - paddingX * 2 - gapX * (maxCountPerRow - 1);
    const uniformCardW = Math.max(40, Math.min(targetCardW, availableWidth / maxCountPerRow));
    const uniformCardH = uniformCardW * aspect;

    const rowLayouts = counts.map((count) => {
      const totalW = count * uniformCardW + gapX * (count - 1);
      return { count, cardW: uniformCardW, cardH: uniformCardH, totalW };
    });

    const totalRowsHeight = rowLayouts.reduce((acc, row) => acc + row.cardH, 0) + gapY * (rowLayouts.length - 1);
    const areaTop = BASE_H - areaHeight + offset.y;
    const currentYStart = areaTop + (areaHeight - totalRowsHeight) / 2 + rowLayouts[0].cardH / 2;
    let currentY = currentYStart;
    //const labelY = startY - 50;
    /*
    this.scene
      .add.text(INTERNAL_W / 2 + offset.x, labelY, "Hand", {
        fontSize: "20px",
        fontFamily: "Arial",
        color: this.palette.text,
        stroke: "#000000",
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setDepth(10);
    */

    let rowIndex = 0;
    let colIndex = 0;
    for (let i = 0; i < this.handCards.length; i++) {
      const layout = rowLayouts[rowIndex];
      const startX = offset.x + (INTERNAL_W - layout.totalW) / 2 + layout.cardW / 2;
      const x = startX + colIndex * (layout.cardW + gapX);
      const y = currentY;
      this.drawHandCard(x, y, layout.cardW, layout.cardH, this.handCards[i]);

      colIndex += 1;
      if (colIndex >= layout.count && rowIndex < rowLayouts.length - 1) {
        // move to next row
        colIndex = 0;
        rowIndex += 1;
        currentY += layout.cardH + gapY;
      }
    }
  }

  setHand(cards: HandCardView[]) {
    this.handCards = cards;
    this.draw(this.lastOffset);
  }

  clearHand() {
    this.handCards = [];
    this.clear();
  }

  setVisible(visible: boolean) {
    // Skip any objects that may have been destroyed; be defensive to avoid runtime errors.
    this.drawnObjects = this.drawnObjects.filter((obj: any) => obj && !obj.destroyed);
    this.drawnObjects.forEach((obj: any) => obj?.setVisible?.(visible));
  }

  fadeIn(duration = 200) {
    this.drawnObjects = this.drawnObjects.filter((obj: any) => obj && !obj.destroyed);
    this.drawnObjects.forEach((obj: any) => {
      if (!obj) return;
      obj.setVisible(true);
      if (typeof obj.setAlpha === "function") obj.setAlpha(0);
      this.scene.tweens.add({
        targets: obj as any,
        alpha: 1,
        duration,
        ease: "Quad.easeOut",
      });
    });
  }

  private drawHandCard(x: number, y: number, w: number, h: number, card: HandCardView) {
    const bg = this.drawHelpers.drawRoundedRect({
      x,
      y,
      width: w,
      height: h,
      radius: 10,
      fillColor: card.color,
      fillAlpha: 1,
      strokeColor: this.palette.accent,
      strokeAlpha: 0.5,
      strokeWidth: 2,
    });
    this.drawnObjects.push(bg);

    if (card.cost !== undefined) {
      const cx = x - w / 2 + 10;
      const cy = y - h / 2 + 10;
      const badge = this.scene.add.circle(cx, cy, 10, 0x2a2d38).setStrokeStyle(1, 0xffffff, 0.8);
      const costLabel = String(card.cost);
      const costText = this.scene.add
        .text(cx, cy, costLabel, { fontSize: "12px", fontFamily: "Arial", color: "#ffffff" })
        .setOrigin(0.5);
      this.drawnObjects.push(badge, costText);
    }

    const inner = this.drawHelpers.drawRoundedRect({
      x,
      y,
      width: w - 7,
      height: h - 10,
      radius: 8,
      fillColor: 0x1a1d26,
      fillAlpha: 0.4,
      strokeColor: 0x000000,
      strokeAlpha: 0.3,
      strokeWidth: 1,
    });
    this.drawnObjects.push(inner);

    if (card.textureKey && this.scene.textures.exists(card.textureKey)) {
      const img = this.scene.add
        .image(x, y, card.textureKey)
        .setDisplaySize(w , h)
        .setDepth((bg.depth || 0) + 1);
      this.drawnObjects.push(img);
    }

    const type = (card.cardType || "").toLowerCase();
    const shouldShowStats = type === "unit" || type === "pilot" || type === "base" || card.fromPilotDesignation;
    if (shouldShowStats) {
      const ap = card.ap ?? 0;
      const hp = card.hp ?? 0;
      const label = `${ap}|${hp}`;
      const badgeW = w * 0.5;
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
      pill.setDepth((bg.depth || 0) + 3);

      const statsText = this.scene.add
        .text(badgeX, badgeY, label, textStyle)
        .setOrigin(0.5)
        .setDepth((bg.depth || 0) + 4);
      this.drawnObjects.push(pill, statsText);
    }
  }

  private clear() {
    this.drawnObjects.forEach((obj) => obj.destroy());
    this.drawnObjects = [];
  }
}
