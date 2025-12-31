import Phaser from "phaser";
import {
  BASE_H,
  INTERNAL_W,
  HAND_CARD_ASPECT,
  HAND_GAP_X,
  HAND_AREA_HEIGHT,
  HAND_VISIBLE_COUNT,
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
  private cardObjects: Phaser.GameObjects.GameObject[] = [];
  private chromeObjects: Phaser.GameObjects.GameObject[] = [];
  private previewContainer?: Phaser.GameObjects.Container;
  private previewTimer?: any;
  private previewActive = false;
  private previewCardUid?: string;
  private lastHandSignature?: string;
  private layout: HandLayoutRenderer;
  private handRoot?: Phaser.GameObjects.Container;
  private cardContainer?: Phaser.GameObjects.Container;
  private maskShape?: Phaser.GameObjects.Graphics;
  private maskRect?: Phaser.Geom.Rectangle;
  private leftArrow?: Phaser.GameObjects.Container;
  private rightArrow?: Phaser.GameObjects.Container;
  private scrollX = 0;
  private scrollTween?: Phaser.Tweens.Tween;
  private scrollDriver = { x: 0 };
  private layoutState?: {
    cardW: number;
    cardH: number;
    gapX: number;
    viewW: number;
    viewH: number;
    viewX: number;
    viewY: number;
    centerY: number;
    minScrollX: number;
    maxScrollX: number;
  };
  private wheelBound = false;
  private dragBound = false;
  private dragActive = false;
  private dragStartX = 0;
  private dragLastX = 0;
  private dragLastTime = 0;
  private dragVelocity = 0;
  private dragSuppressClick = false;
  private inertiaActive = false;
  private updateBound = false;
  private debug = true;
  private config = {
    preview: {
      holdDelay: 400,
      overlayAlpha: 0.65,
      cardWidth: 350,
      cardAspect: 88 / 63,
      fadeIn: 180,
      fadeOut: 150,
      badgeSize: { w: 70, h: 45 },
      badgeFontSize: 20,
    },
    arrows: {
      size: 15,
      edgeInset: 6,
      overlap: 0,
      activeAlpha: 1,
      inactiveAlpha: 0.5,
      color: "#f5f6fb",
      hitPad: 18,
    },
    scroll: {
      duration: 220,
    },
  };
  private onCardClick?: (card: HandCardView) => void;
  private selectedCardUid?: string;

  constructor(private scene: Phaser.Scene, palette: Palette, drawHelpers: DrawHelpers) {
    this.layout = new HandLayoutRenderer(scene, palette, drawHelpers);
  }

  draw(offset: Offset) {
    this.lastOffset = offset;
    // Preserve any active preview while refreshing card sprites during autopolls.
    this.clearCards();
    this.ensureChrome();

    const gapX = HAND_GAP_X;
    const paddingX = HAND_PADDING_X;
    const maxVisible = HAND_VISIBLE_COUNT;
    const camW = this.scene.scale.width;
    const viewW = Math.max(120, camW * 0.95 - paddingX * 2);
    const cardW = Math.max(
      60,
      Math.min(HAND_TARGET_CARD_W, (viewW - gapX * (maxVisible - 1)) / maxVisible),
    );
    const cardH = cardW * HAND_CARD_ASPECT;
    const viewH = Math.max(cardH + 6, HAND_AREA_HEIGHT);
    const viewX = (camW - viewW) / 2;
    const viewY = BASE_H - viewH - 12 + offset.y;
    const centerY = viewY + viewH / 2;
    const totalW = this.handCards.length
      ? this.handCards.length * cardW + gapX * (this.handCards.length - 1)
      : 0;
    const centeredX = totalW < viewW ? (viewW - totalW) / 2 : 0;
    const minScrollX = totalW < viewW ? centeredX : Math.min(0, viewW - totalW);
    const maxScrollX = totalW < viewW ? centeredX : 0;
    this.layoutState = { cardW, cardH, gapX, viewW, viewH, viewX, viewY, centerY, minScrollX, maxScrollX };

    if (this.cardContainer) {
      this.applyScrollX(Phaser.Math.Clamp(this.scrollX, minScrollX, maxScrollX));
      this.scrollDriver.x = this.scrollX;
      this.cardContainer.setY(centerY);
    }

    this.updateMask();
    this.updateArrows();
    this.bindWheelScroll();
    this.bindDragScroll();
    this.bindInertiaTick();
    if (this.debug) {
      // eslint-disable-next-line no-console
      console.log("[HandArea] layout", {
        count: this.handCards.length,
        viewW,
        viewH,
        cardW,
        cardH,
        viewX,
        viewY,
        scrollX: this.scrollX,
        minScrollX,
      });
    }
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

    for (let i = 0; i < this.handCards.length; i++) {
      const x = cardW / 2 + i * (cardW + gapX);
      const y = 0;
      this.drawHandCard(x, y, cardW, cardH, this.handCards[i]);
    }
  }

  setHand(cards: HandCardView[], opts?: { preserveSelectionUid?: string }) {
    const signature = this.buildHandSignature(cards);
    // Skip redraw if nothing changed; prevents autopolls from killing previews/interaction.
    if (signature && signature === this.lastHandSignature) {
      this.updateArrows();
      return;
    }
    this.lastHandSignature = signature;
    this.handCards = cards;
    // Keep preview alive across updates if the card still exists; hide if it vanished.
    if (this.previewActive && this.previewCardUid) {
      const stillPresent = cards.find((c) => c.uid === this.previewCardUid);
      if (!stillPresent) {
        this.hidePreview(true);
      }
    }
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
    this.clearCards();
    this.hidePreview(true);
  }

  setVisible(visible: boolean) {
    // Skip any objects that may have been destroyed; be defensive to avoid runtime errors.
    const all = [...this.chromeObjects, ...this.cardObjects];
    const filtered = all.filter((obj: any) => obj && !obj.destroyed);
    filtered.forEach((obj: any) => {
      obj?.setVisible?.(visible);
      if (visible && typeof obj?.setAlpha === "function") obj.setAlpha(1);
    });
  }

  clearSelection() {
    if (!this.selectedCardUid) return;
    this.selectedCardUid = undefined;
    this.draw(this.lastOffset);
  }

  setCardClickHandler(handler: (card: HandCardView) => void) {
    this.onCardClick = handler;
  }

  fadeIn() {
    // Disable fade animation to prevent flashing during frequent updates.
    const all = [...this.chromeObjects, ...this.cardObjects];
    const filtered = all.filter((obj: any) => obj && !obj.destroyed);
    filtered.forEach((obj: any) => {
      if (!obj) return;
      obj.setVisible(true);
      if (typeof obj.setAlpha === "function") obj.setAlpha(1);
    });
  }

  private drawHandCard(x: number, y: number, w: number, h: number, card: HandCardView) {
    const isSelected = card.uid && card.uid === this.selectedCardUid;
    const drawn = this.layout.renderCard(x, y, w, h, card, !!isSelected);
    drawn.forEach((node) => this.cardContainer?.add(node));
    this.cardObjects.push(...drawn);

    // Interaction zone for long-press preview.
    const hit = this.scene.add.zone(x, y, w, h).setOrigin(0.5).setInteractive({ useHandCursor: false });
    hit.on("pointerdown", () => this.startPreviewTimer(card));
    hit.on("pointerup", () => this.handlePointerUp(card));
    hit.on("pointerout", () => this.handlePointerOut());
    this.cardContainer?.add(hit);
    this.cardObjects.push(hit);
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
    if (this.dragSuppressClick) {
      this.dragSuppressClick = false;
      return;
    }
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
    this.previewCardUid = card.uid;
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
    this.previewCardUid = undefined;
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
    this.previewCardUid = card.uid;
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

  private buildHandSignature(cards: HandCardView[]) {
    if (!cards || cards.length === 0) return "empty";
    return cards
      .map((c) =>
        [
          c.uid ?? "",
          c.cardId ?? "",
          c.cardType ?? "",
          c.cost ?? "",
          c.ap ?? "",
          c.hp ?? "",
          c.fromPilotDesignation ? "1" : "0",
          c.textureKey ?? "",
        ].join(":"),
      )
      .join("|");
  }

  private clear(opts: { destroyPreview?: boolean } = {}) {
    this.clearCards();
    if (opts.destroyPreview) {
      this.hidePreview(true);
    }
  }

  private clearCards() {
    this.cardObjects.forEach((obj) => obj.destroy());
    this.cardObjects = [];
  }

  private ensureChrome() {
    if (!this.handRoot) {
      this.handRoot = this.scene.add.container(0, 0).setDepth(1200);
      this.chromeObjects.push(this.handRoot);
    }
    if (!this.cardContainer) {
      this.cardContainer = this.scene.add.container(0, 0);
      this.handRoot.add(this.cardContainer);
    }
    if (!this.maskShape) {
      this.maskShape = this.scene.add.graphics();
      this.maskShape.setVisible(false);
      this.chromeObjects.push(this.maskShape);
    }
    if (!this.leftArrow) {
      this.leftArrow = this.buildArrow(-1);
      this.chromeObjects.push(this.leftArrow);
    }
    if (!this.rightArrow) {
      this.rightArrow = this.buildArrow(1);
      this.chromeObjects.push(this.rightArrow);
    }
  }

  private updateMask() {
    if (!this.layoutState || !this.maskShape || !this.cardContainer) return;
    const { viewX, viewY, viewW, viewH } = this.layoutState;
    this.maskShape.clear();
    this.maskShape.fillStyle(0xffffff, 1);
    this.maskShape.fillRect(viewX, viewY, viewW, viewH);
    this.maskRect = new Phaser.Geom.Rectangle(viewX, viewY, viewW, viewH);
    if (!this.cardContainer.mask) {
      this.cardContainer.setMask(this.maskShape.createGeometryMask());
    }
  }

  private updateArrows() {
    if (!this.layoutState || !this.leftArrow || !this.rightArrow) return;
    const { centerY, minScrollX, maxScrollX } = this.layoutState;
    const camW = this.scene.scale.width;
    const leftX = 14.5;
    const rightX = camW;
    this.leftArrow.setPosition(leftX, centerY);
    this.rightArrow.setPosition(rightX, centerY);
    const canScroll = minScrollX !== maxScrollX;
    const canScrollLeft = this.scrollX < maxScrollX - 1 && canScroll;
    const canScrollRight = this.scrollX > minScrollX + 1 && canScroll;
    this.setArrowState(this.leftArrow, canScrollLeft);
    this.setArrowState(this.rightArrow, canScrollRight);
    if (this.debug) {
      // eslint-disable-next-line no-console
      console.log("[HandArea] arrows", {
        canScrollLeft,
        canScrollRight,
        scrollX: this.scrollX,
        minScrollX,
      });
    }
  }

  private setArrowState(arrow: Phaser.GameObjects.Container, active: boolean) {
    arrow.setVisible(active);
    const hit = arrow.getByName("hit") as Phaser.GameObjects.Zone | undefined;
    if (!hit) return;
    if (active) {
      hit.setInteractive({ useHandCursor: true });
    } else {
      hit.disableInteractive();
    }
  }

  private scrollByStep(direction: -1 | 1) {
    if (!this.layoutState) return;
    const step = (this.layoutState.cardW + this.layoutState.gapX) * direction;
    this.scrollTo(this.scrollX - step);
  }

  private scrollTo(targetX: number) {
    if (!this.layoutState || !this.cardContainer) return;
    const clamped = Phaser.Math.Clamp(targetX, this.layoutState.minScrollX, this.layoutState.maxScrollX);
    if (Math.abs(clamped - this.scrollX) < 0.5) {
      this.updateArrows();
      return;
    }
    this.scrollTween?.stop();
    this.inertiaActive = false;
    this.scrollDriver.x = this.scrollX;
    const distance = Math.abs(clamped - this.scrollX);
    const duration = Math.min(320, Math.max(140, distance * 1.2));
    this.scrollTween = this.scene.tweens.add({
      targets: this.scrollDriver,
      x: clamped,
      duration,
      ease: "Cubic.easeOut",
      onUpdate: () => {
        this.applyScrollX(this.scrollDriver.x);
      },
      onComplete: () => {
        this.applyScrollX(clamped);
        this.updateArrows();
      },
    });
  }

  private bindWheelScroll() {
    if (this.wheelBound) return;
    this.wheelBound = true;
    this.scene.input.on("wheel", (_pointer: Phaser.Input.Pointer, _go: any, dx: number, dy: number) => {
      if (!this.layoutState || !this.maskRect) return;
      const pointer = this.scene.input.activePointer;
      if (!this.maskRect.contains(pointer.x, pointer.y)) return;
      const delta = dx !== 0 ? dx : dy;
      if (delta === 0) return;
      const stepCap = this.layoutState.cardW + this.layoutState.gapX;
      const clampedDelta = Phaser.Math.Clamp(delta, -stepCap, stepCap);
      this.scrollTo(this.scrollX - clampedDelta);
    });
  }

  private bindDragScroll() {
    if (this.dragBound) return;
    this.dragBound = true;
    this.scene.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (!this.layoutState || !this.maskRect) return;
      if (!this.maskRect.contains(pointer.x, pointer.y)) return;
      this.dragActive = true;
      this.dragSuppressClick = false;
      this.dragStartX = pointer.x;
      this.dragLastX = pointer.x;
      this.dragLastTime = this.scene.time.now;
      this.dragVelocity = 0;
      this.inertiaActive = false;
      this.scrollTween?.stop();
    });
    this.scene.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (!this.dragActive || !this.layoutState || !this.cardContainer) return;
      const now = this.scene.time.now;
      const dx = pointer.x - this.dragLastX;
      const dt = Math.max(1, now - this.dragLastTime);
      if (Math.abs(pointer.x - this.dragStartX) > 4) {
        this.dragSuppressClick = true;
        this.cancelPreviewTimer();
      }
      const next = Phaser.Math.Clamp(this.scrollX + dx, this.layoutState.minScrollX, this.layoutState.maxScrollX);
      this.applyScrollX(next);
      this.dragVelocity = dx / dt;
      this.dragLastX = pointer.x;
      this.dragLastTime = now;
      this.updateArrows();
    });
    this.scene.input.on("pointerup", () => {
      if (!this.dragActive) return;
      this.dragActive = false;
      const speed = this.dragVelocity;
      if (Math.abs(speed) > 0.02) {
        this.startInertia(speed);
      }
    });
    this.scene.input.on("pointerupoutside", () => {
      if (!this.dragActive) return;
      this.dragActive = false;
      const speed = this.dragVelocity;
      if (Math.abs(speed) > 0.02) {
        this.startInertia(speed);
      }
    });
  }

  private bindInertiaTick() {
    if (this.updateBound) return;
    this.updateBound = true;
    this.scene.events.on("update", (_time: number, delta: number) => {
      if (!this.inertiaActive || !this.layoutState || !this.cardContainer) return;
      const dt = Math.max(1, delta);
      const next = this.scrollX + this.dragVelocity * dt;
      const clamped = Phaser.Math.Clamp(next, this.layoutState.minScrollX, this.layoutState.maxScrollX);
      this.applyScrollX(clamped);
      const friction = Math.pow(0.92, dt / 16.67);
      this.dragVelocity *= friction;
      if (this.scrollX === this.layoutState.minScrollX || this.scrollX === 0) {
        this.dragVelocity = 0;
      }
      if (Math.abs(this.dragVelocity) < 0.01) {
        this.inertiaActive = false;
        this.dragVelocity = 0;
      }
      this.updateArrows();
    });
  }

  private startInertia(speed: number) {
    this.inertiaActive = true;
    this.dragVelocity = speed;
  }

  private applyScrollX(next: number) {
    if (!this.layoutState || !this.cardContainer) return;
    this.scrollX = next;
    this.cardContainer.setX(this.layoutState.viewX + this.scrollX);
  }

  private buildArrow(direction: -1 | 1) {
    const size = this.config.arrows.size;
    const color = this.config.arrows.color;
    const arrow = this.scene.add.container(0, 0).setDepth(1210);
    const triangle = this.scene.add.triangle(
      0,
      0,
      direction < 0 ? size / 2 : -size / 2,
      -size / 2,
      direction < 0 ? size / 2 : -size / 2,
      size / 2,
      direction < 0 ? -size / 2 : size / 2,
      0,
      Phaser.Display.Color.HexStringToColor(color).color,
      1,
    );
    triangle.setStrokeStyle(1, 0x0f1118, 0.8);
    const hitSize = size + this.config.arrows.hitPad;
    const hit = this.scene.add.zone(0, 0, hitSize, hitSize).setName("hit");
    hit.on("pointerup", () => this.scrollByStep(direction));
    arrow.add([triangle, hit]);
    return arrow;
  }
}
