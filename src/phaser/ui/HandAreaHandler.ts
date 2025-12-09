import Phaser from "phaser";
import {
  BASE_H,
  INTERNAL_W,
  HAND_AREA_HEIGHT,
  HAND_CARD_ASPECT,
  HAND_GAP_X,
  HAND_GAP_Y,
  HAND_MAX_PER_ROW,
  HAND_PADDING_X,
  HAND_TARGET_CARD_W,
} from "../../config/gameLayout";
import { DrawHelpers } from "./HeaderHandler";
import { Offset, Palette } from "./types";
import type { HandCardView } from "./HandTypes";
import { drawPreviewBadge } from "./PreviewBadge";

export class HandAreaHandler {
  private handCards: HandCardView[] = [];
  private lastOffset: Offset = { x: 0, y: 0 };
  private drawnObjects: Phaser.GameObjects.GameObject[] = [];
  private previewContainer?: Phaser.GameObjects.Container;
  private previewTimer?: any;
  private previewActive = false;
  private config = {
    preview: {
      holdDelay: 400,
      overlayAlpha: 0.65,
      cardWidth: 350,
      cardAspect: 88 / 64,
      fadeIn: 180,
      fadeOut: 150,
      badgeSize: { w: 70, h: 45 },
      badgeFontSize: 20,
    },
  };
  private onCardClick?: (card: HandCardView) => void;
  private selectedCardUid?: string;

  constructor(private scene: Phaser.Scene, private palette: Palette, private drawHelpers: DrawHelpers) {}

  draw(offset: Offset) {
    this.lastOffset = offset;
    this.clear();

    const maxPerRow = HAND_MAX_PER_ROW;
    const totalCards = this.handCards.length;
    const counts = [Math.min(maxPerRow, totalCards), Math.max(totalCards - maxPerRow, 0)].filter((c) => c > 0);
    const gapX = HAND_GAP_X;
    const gapY = HAND_GAP_Y;
    const paddingX = HAND_PADDING_X;
    const targetCardW = HAND_TARGET_CARD_W;
    const aspect = HAND_CARD_ASPECT;
    const areaHeight = HAND_AREA_HEIGHT;

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
    // Reset selection on re-render (e.g., cancel actions).
    this.selectedCardUid = undefined;
    this.draw(this.lastOffset);
  }

  clearHand() {
    this.handCards = [];
    this.selectedCardUid = undefined;
    this.clear();
  }

  setVisible(visible: boolean) {
    // Skip any objects that may have been destroyed; be defensive to avoid runtime errors.
    this.drawnObjects = this.drawnObjects.filter((obj: any) => obj && !obj.destroyed);
    this.drawnObjects.forEach((obj: any) => obj?.setVisible?.(visible));
  }

  setCardClickHandler(handler: (card: HandCardView) => void) {
    this.onCardClick = handler;
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
    const isSelected = card.uid && card.uid === this.selectedCardUid;
    const bg = this.drawHelpers.drawRoundedRect({
      x,
      y,
      width: w,
      height: h,
      radius: 10,
      fillColor: card.color,
      fillAlpha: 1,
      strokeColor: isSelected ? 0x00ff00 : this.palette.accent,
      strokeAlpha: isSelected ? 0.9 : 0.5,
      strokeWidth: isSelected ? 3 : 2,
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

    // Selected highlight frame on top of everything else.
    /*
    if (isSelected) {
      const highlight = this.scene.add.graphics({ x: x - w / 2, y: y - h / 2 });
      highlight.lineStyle(3, 0x00ff00, 10);
      highlight.strokeRoundedRect(0, 0, w, h, 10);
      highlight.setDepth((bg.depth || 0) + 6);
      this.drawnObjects.push(highlight);
    }*/
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
      this.drawStatsBadge(x, y, w, h, card, bg.depth || 0);
    }

    // Interaction zone for long-press preview.
    const hit = this.scene.add.zone(x, y, w, h).setOrigin(0.5).setInteractive({ useHandCursor: false });
    hit.on("pointerdown", () => this.startPreviewTimer(card));
    hit.on("pointerup", () => this.handlePointerUp(card));
    hit.on("pointerout", () => this.handlePointerOut());
    this.drawnObjects.push(hit);
  }

  private drawCostBadge(x: number, y: number, w: number, h: number, cost: number | string, baseDepth: number) {
    const cx = x - w / 2 + 10;
    const cy = y - h / 2 + 10;
    const badge = this.scene.add.circle(cx, cy, 10, 0x2a2d38).setStrokeStyle(1, 0xffffff, 0.8).setDepth(baseDepth + 1);
    const costText = this.scene.add
      .text(cx, cy, String(cost), { fontSize: "12px", fontFamily: "Arial", color: "#ffffff" })
      .setOrigin(0.5)
      .setDepth(baseDepth + 2);
    this.drawnObjects.push(badge, costText);
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
    this.drawnObjects.push(pill, statsText);
  }

  // --- Preview handling (mirrors slot preview styling) ---
  private startPreviewTimer(card: HandCardView) {
    this.hidePreview();
    this.previewTimer = setTimeout(() => {
      this.previewTimer = undefined;
      this.showPreview(card);
    }, this.config.preview.holdDelay);
  }

  private handlePointerUp(card?: HandCardView) {
    if (this.previewActive) return;
    if (card && this.onCardClick) {
      this.selectedCardUid = card.uid || undefined;
      this.onCardClick(card);
      // Redraw to apply highlight state.
      this.draw(this.lastOffset);
    }
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

  private showPreview(card: HandCardView) {
    this.hidePreview(true);
    const cam = this.scene.cameras.main;
    const cx = cam.centerX;
    const cy = cam.centerY;
    const cardW = this.config.preview.cardWidth;
    const cardH = cardW * this.config.preview.cardAspect;
    const container = this.scene.add.container(cx, cy).setDepth(2000).setAlpha(0);

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x000000, this.config.preview.overlayAlpha);
    bg.fillRect(-cam.width / 2, -cam.height / 2, cam.width, cam.height);
    bg.setInteractive(new Phaser.Geom.Rectangle(-cam.width / 2, -cam.height / 2, cam.width, cam.height), Phaser.Geom.Rectangle.Contains);
    bg.on("pointerdown", () => this.hidePreview());
    container.add(bg);

    this.drawPreviewCard(container, 0, 0, cardW, cardH, card);

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
    card: HandCardView,
  ) {
    const texKey = this.toTextureKey(card.textureKey);
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

    const insideLabel = this.getBadgeLabel(card);
    if (insideLabel) {
      const badgeW = this.config.preview.badgeSize.w+15;
      const badgeH = this.config.preview.badgeSize.h;

      let extraSpace = 0
      if(card.cardType == "pilot"){
        extraSpace = -78
      }
      if(card.cardType == "command"){
        extraSpace = -7
      }
      this.drawPreviewBadge(
        container,
        x + w / 2 - badgeW / 2,
        y + h / 2 - badgeH / 2 + extraSpace,
        badgeW,
        badgeH,
        insideLabel,
        2,
      );
    }
    // Hand cards have no field totals; skip total badge.
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
    drawPreviewBadge({
      container,
      drawHelpers: this.drawHelpers,
      x: badgeX,
      y: badgeY,
      width: w,
      height: h,
      label,
      baseDepth,
      fillColor: 0x000000,
      fillAlpha: 1,
      radius: 6,
      widthPad: 0,
      depthPillOffset: 1,
      depthTextOffset: 2,
      textStyle: {
        fontSize: `${this.config.preview.badgeFontSize}px`,
        fontFamily: "Arial",
        fontStyle: "bold",
        color: "#ffffff",
      },
    });
  }

  private toTextureKey(textureKey?: string) {
    if (!textureKey) return undefined;
    return textureKey.replace(/-preview$/, "");
  }

  private getBadgeLabel(card: HandCardView) {
    if (!card) return undefined;
    const type = (card.cardType || "").toLowerCase();
    if (type === "command") {
      if (!card.fromPilotDesignation) return undefined;
      const ap = Number(card.ap ?? 0);
      const hp = Number(card.hp ?? 0);
      return `${ap}|${hp}`;
    }
    if (type === "unit" || type === "pilot" || type === "base" || card.fromPilotDesignation) {
      const ap = Number(card.ap ?? 0);
      const hp = Number(card.hp ?? 0);
      return `${ap}|${hp}`;
    }
    return undefined;
  }

  private clear() {
    this.drawnObjects.forEach((obj) => obj.destroy());
    this.drawnObjects = [];
    this.hidePreview(true);
  }
}
