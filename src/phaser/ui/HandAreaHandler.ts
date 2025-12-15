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
import { HandLayoutRenderer } from "./HandLayoutRenderer";

export class HandAreaHandler {
  private handCards: HandCardView[] = [];
  private lastOffset: Offset = { x: 0, y: 0 };
  private drawnObjects: Phaser.GameObjects.GameObject[] = [];
  private previewContainer?: Phaser.GameObjects.Container;
  private previewTimer?: any;
  private previewActive = false;
  private layout: HandLayoutRenderer;
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

  constructor(private scene: Phaser.Scene, private palette: Palette, private drawHelpers: DrawHelpers) {
    this.layout = new HandLayoutRenderer(scene, palette, drawHelpers);
  }

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

    // Anchor to the expected top-of-hand used by the ActionButtonBar (fixed reference height) so larger cards grow downward.
    const refLayout = { cardH: 90, gap: 5, rows: 2, bottomPadding: 24 };
    const refTotalHeight = refLayout.rows * refLayout.cardH + (refLayout.rows - 1) * refLayout.gap;
    const refHandTop = BASE_H - refLayout.bottomPadding - refTotalHeight + offset.y;
    const currentYStart = refHandTop + uniformCardH / 2;
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

  setHand(cards: HandCardView[], opts?: { preserveSelectionUid?: string }) {
    this.handCards = cards;
    // Preserve selection if requested and the card still exists; otherwise clear it.
    const maybeKeep = opts?.preserveSelectionUid;
    if (maybeKeep && cards.some((c) => c.uid === maybeKeep)) {
      this.selectedCardUid = maybeKeep;
    } else {
      this.selectedCardUid = undefined;
    }
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

  clearSelection() {
    if (!this.selectedCardUid) return;
    this.selectedCardUid = undefined;
    this.draw(this.lastOffset);
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
    const drawn = this.layout.renderCard(x, y, w, h, card, !!isSelected);
    this.drawnObjects.push(...drawn);

    // Interaction zone for long-press preview.
    const hit = this.scene.add.zone(x, y, w, h).setOrigin(0.5).setInteractive({ useHandCursor: false });
    hit.on("pointerdown", () => this.startPreviewTimer(card));
    hit.on("pointerup", () => this.handlePointerUp(card));
    hit.on("pointerout", () => this.handlePointerOut());
    this.drawnObjects.push(hit);
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
    const insideLabel = this.getBadgeLabel(card);
    this.layout.renderPreview(container, x, y, w, h, texKey, insideLabel, card, {
      badgeSize: this.config.preview.badgeSize,
      badgeFontSize: this.config.preview.badgeFontSize,
    });
    // Hand cards have no field totals; skip total badge.
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
