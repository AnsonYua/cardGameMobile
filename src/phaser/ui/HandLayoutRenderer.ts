import Phaser from "phaser";
import { drawPreviewBadge } from "./PreviewBadge";
import { DrawHelpers } from "./HeaderHandler";
import { Palette } from "./types";
import type { HandCardView } from "./HandTypes";

export type HandPreviewConfig = {
  badgeSize: { w: number; h: number };
  badgeFontSize: number;
};

export class HandLayoutRenderer {
  private cardAspect = 63 / 88;

  constructor(private scene: Phaser.Scene, private palette: Palette, private drawHelpers: DrawHelpers) {}

  renderCard(x: number, y: number, w: number, h: number, card: HandCardView, isSelected: boolean) {
    const drawn: Phaser.GameObjects.GameObject[] = [];

    const bg = this.drawHelpers.drawRoundedRect({
      x,
      y,
      width: w,
      height: h,
      radius: 0,
      fillColor: card.color,
      fillAlpha: 1,
      strokeColor: isSelected ? 0x00ff00 : this.palette.accent,
      strokeAlpha: isSelected ? 0.9 : 0,
      strokeWidth: isSelected ? 5 : 2,
    });
    bg.setDepth(200)
    drawn.push(bg);

    if (card.cost !== undefined) {
      drawn.push(...this.drawCostBadge(x, y, w, h, card.cost, bg.depth || 0));
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
    drawn.push(inner);

    if (card.textureKey && this.scene.textures.exists(card.textureKey)) {
      const fitted = this.fitCardSize(w, h);
      const img = this.scene.add
        .image(x, y, card.textureKey)
        .setDisplaySize(fitted.w, fitted.h)
        .setDepth((bg.depth || 0) + 1);
      drawn.push(img);
    }

    const type = (card.cardType || "").toLowerCase();
    const shouldShowStats = type === "unit" || type === "pilot" || type === "base" || card.fromPilotDesignation;
    if (shouldShowStats) {
      drawn.push(...this.drawStatsBadge(x, y, w, h, card, bg.depth || 0));
    }

    return drawn;
  }

  renderPreview(
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    w: number,
    h: number,
    textureKey: string | undefined,
    label: string | undefined,
    card: HandCardView | undefined,
    config: HandPreviewConfig,
  ) {
    const hasTex = textureKey && this.scene.textures.exists(textureKey);
    const fitted = this.fitCardSize(w, h);
    const img = hasTex
      ? this.scene.add.image(x, y, textureKey!).setDisplaySize(fitted.w, fitted.h).setOrigin(0.5)
      : this.drawHelpers.drawRoundedRect({
          x,
          y,
          width: fitted.w,
          height: fitted.h,
          radius: 12,
          fillColor: "#cbd3df",
          fillAlpha: 0.9,
          strokeColor: "#0f1118",
          strokeAlpha: 0.8,
          strokeWidth: 2,
        });
    img.setDepth(1);
    container.add(img);

    if (!label) return;

    const badgeW = config.badgeSize.w + 15;
    const badgeH = config.badgeSize.h;
    let extraSpace = 0;
    const type = (card?.cardType || "").toLowerCase();
    if (type === "pilot") extraSpace = -78;
    if (type === "command") extraSpace = -7;

    drawPreviewBadge({
      container,
      drawHelpers: this.drawHelpers,
      x: x + fitted.w / 2 - badgeW / 2,
      y: y + fitted.h / 2 - badgeH / 2 + extraSpace,
      width: badgeW,
      height: badgeH,
      label,
      baseDepth: 2,
      fillColor: 0x000000,
      fillAlpha: 1,
      radius: 6,
      widthPad: 0,
      depthPillOffset: 1,
      depthTextOffset: 2,
      textStyle: {
        fontSize: `${config.badgeFontSize}px`,
        fontFamily: "Arial",
        fontStyle: "bold",
        color: "#ffffff",
      },
    });
  }

  private fitCardSize(w: number, h: number) {
    const maxW = Math.max(1, w);
    const maxH = Math.max(1, h);
    let fitW = Math.min(maxW, maxH * this.cardAspect);
    let fitH = fitW / this.cardAspect;
    if (fitH > maxH) {
      fitH = maxH;
      fitW = fitH * this.cardAspect;
    }
    return { w: fitW, h: fitH };
  }

  private drawCostBadge(x: number, y: number, w: number, h: number, cost: number | string, baseDepth: number) {
    const drawn: Phaser.GameObjects.GameObject[] = [];
    const cx = x - w / 2 + 10;
    const cy = y - h / 2 + 10;
    const badge = this.scene.add.circle(cx, cy, 10, 0x2a2d38).setStrokeStyle(1, 0xffffff, 0.8).setDepth(baseDepth + 1);
    const costText = this.scene.add
      .text(cx, cy, String(cost), { fontSize: "12px", fontFamily: "Arial", color: "#ffffff" })
      .setOrigin(0.5)
      .setDepth(baseDepth + 2);
    drawn.push(badge, costText);
    return drawn;
  }

  private drawStatsBadge(x: number, y: number, w: number, h: number, card: HandCardView, baseDepth: number) {
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
    pill.setDepth(baseDepth + 3);

    const statsText = this.scene.add
      .text(badgeX, badgeY, label, textStyle)
      .setOrigin(0.5)
      .setDepth(baseDepth + 4);
    return [pill, statsText];
  }
}
