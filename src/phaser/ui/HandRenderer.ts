import Phaser from "phaser";
import type { HandCardView } from "./HandTypes";
import type { HandLayoutState } from "./HandLayout";
import type { HandLayoutRenderer } from "./HandLayoutRenderer";

export type HandArrowConfig = {
  size: number;
  edgeInset: number;
  overlap: number;
  activeAlpha: number;
  inactiveAlpha: number;
  color: string;
  hitPad: number;
};

export class HandRenderer {
  private cardObjects: Phaser.GameObjects.GameObject[] = [];
  private chromeObjects: Phaser.GameObjects.GameObject[] = [];
  private handRoot?: Phaser.GameObjects.Container;
  private cardContainer?: Phaser.GameObjects.Container;
  private maskShape?: Phaser.GameObjects.Graphics;
  private maskRect?: Phaser.Geom.Rectangle;
  private leftArrow?: Phaser.GameObjects.Container;
  private rightArrow?: Phaser.GameObjects.Container;
  private layoutState?: HandLayoutState;

  constructor(
    private scene: Phaser.Scene,
    private layout: HandLayoutRenderer,
    private arrows: HandArrowConfig,
  ) {}

  setLayout(state: HandLayoutState) {
    this.layoutState = state;
    this.ensureChrome();
    if (this.cardContainer) {
      this.cardContainer.setY(state.centerY);
    }
    this.updateMask();
  }

  getMaskRect() {
    return this.maskRect;
  }

  setScrollX(scrollX: number) {
    if (!this.layoutState || !this.cardContainer) return;
    this.cardContainer.setX(this.layoutState.viewX + scrollX);
  }

  renderCards(
    cards: HandCardView[],
    selectedUid: string | undefined,
    onPointerDown: (card: HandCardView) => void,
    onPointerUp: (card: HandCardView) => void,
    onPointerOut: () => void,
  ) {
    if (!this.layoutState) return;
    this.clearCards();
    this.ensureChrome();
    const { cardW, cardH, gapX } = this.layoutState;

    cards.forEach((card, index) => {
      const x = cardW / 2 + index * (cardW + gapX);
      const y = 0;
      const isSelected = card.uid && card.uid === selectedUid;
      const drawn = this.layout.renderCard(x, y, cardW, cardH, card, !!isSelected);
      drawn.forEach((node) => this.cardContainer?.add(node));
      this.cardObjects.push(...drawn);

      const hit = this.scene.add.zone(x, y, cardW, cardH).setOrigin(0.5).setInteractive({ useHandCursor: false });
      hit.on("pointerdown", () => onPointerDown(card));
      hit.on("pointerup", () => onPointerUp(card));
      hit.on("pointerout", () => onPointerOut());
      this.cardContainer?.add(hit);
      this.cardObjects.push(hit);
    });
  }

  updateArrows(scrollX: number, minScrollX: number, maxScrollX: number) {
    if (!this.layoutState || !this.leftArrow || !this.rightArrow) return;
    const camW = this.scene.scale.width;
    const leftX = 14.5;
    const rightX = camW;
    this.leftArrow.setPosition(leftX, this.layoutState.centerY);
    this.rightArrow.setPosition(rightX, this.layoutState.centerY);
    const canScroll = minScrollX !== maxScrollX;
    const canScrollLeft = scrollX < maxScrollX - 1 && canScroll;
    const canScrollRight = scrollX > minScrollX + 1 && canScroll;
    this.setArrowState(this.leftArrow, canScrollLeft);
    this.setArrowState(this.rightArrow, canScrollRight);
  }

  setArrowHandlers(onLeft: () => void, onRight: () => void) {
    this.ensureChrome();
    const leftHit = this.leftArrow?.getByName("hit") as Phaser.GameObjects.Zone | undefined;
    const rightHit = this.rightArrow?.getByName("hit") as Phaser.GameObjects.Zone | undefined;
    leftHit?.on("pointerup", onLeft);
    rightHit?.on("pointerup", onRight);
  }

  setVisible(visible: boolean) {
    const all = [...this.chromeObjects, ...this.cardObjects];
    const filtered = all.filter((obj: any) => obj && !obj.destroyed);
    filtered.forEach((obj: any) => {
      obj?.setVisible?.(visible);
      if (visible && typeof obj?.setAlpha === "function") obj.setAlpha(1);
    });
  }

  destroy() {
    this.clearCards();
    this.chromeObjects.forEach((obj) => obj.destroy());
    this.chromeObjects = [];
    this.handRoot = undefined;
    this.cardContainer = undefined;
    this.maskShape = undefined;
    this.maskRect = undefined;
    this.leftArrow = undefined;
    this.rightArrow = undefined;
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

  private buildArrow(direction: -1 | 1) {
    const size = this.arrows.size;
    const color = this.arrows.color;
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
    const hitSize = size + this.arrows.hitPad;
    const hit = this.scene.add.zone(0, 0, hitSize, hitSize).setName("hit");
    arrow.add([triangle, hit]);
    return arrow;
  }
}
