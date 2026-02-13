import Phaser from "phaser";

export type ScrollBounds = { x: number; y: number; width: number; height: number };
export type ScrollbarConfig = { width: number; pad: number; minThumb: number; trackX: number };

export class ScrollList {
  private maskShape?: Phaser.GameObjects.Graphics;
  private scrollbarTrack?: Phaser.GameObjects.Rectangle;
  private scrollbarThumb?: Phaser.GameObjects.Rectangle;
  private scrollY = 0;
  private maxScroll = 0;
  private wheelHandler?: (pointer: Phaser.Input.Pointer, gameObjects: any[], dx: number, dy: number) => void;
  private pointerDownHandler?: (pointer: Phaser.Input.Pointer) => void;
  private thumbDragState?: { startWorldY: number; startScroll: number };
  private contentDragState?: { startWorldY: number; startScroll: number; active: boolean };
  private pointerMoveHandler?: (pointer: Phaser.Input.Pointer) => void;
  private pointerUpHandler?: () => void;
  private readonly dragThreshold = 6;

  constructor(
    private scene: Phaser.Scene,
    private container: Phaser.GameObjects.Container,
    private content: Phaser.GameObjects.Container,
    private bounds: ScrollBounds,
    private scrollbar: ScrollbarConfig,
  ) {
    this.createMask();
  }

  setContentHeight(contentHeight: number) {
    this.maxScroll = Math.max(0, contentHeight - this.bounds.height);
    this.scrollY = 0;
    this.content.setY(0);
    this.updateScrollbar();
  }

  attach() {
    if (this.wheelHandler) return;
    this.wheelHandler = (pointer, _gameObjects, _dx, dy) => {
      if (!this.isPointerInScrollArea(pointer)) return;
      this.updateScroll(this.scrollY + dy * 0.5);
    };
    this.pointerDownHandler = (pointer: Phaser.Input.Pointer) => {
      if (this.maxScroll <= 0) return;
      if (!this.isPointerInScrollArea(pointer)) return;
      if (this.isPointerOnThumb(pointer)) return;
      const world = this.getPointerWorld(pointer);
      this.contentDragState = { startWorldY: world.y, startScroll: this.scrollY, active: false };
    };
    this.pointerMoveHandler = (pointer: Phaser.Input.Pointer) => {
      const world = this.getPointerWorld(pointer);

      if (this.thumbDragState && this.scrollbarThumb) {
        const trackHeight = this.bounds.height;
        const thumbHeight = this.scrollbarThumb.height;
        const range = Math.max(1, trackHeight - thumbHeight);
        const deltaY = world.y - this.thumbDragState.startWorldY;
        const ratio = deltaY / range;
        this.updateScroll(this.thumbDragState.startScroll + ratio * this.maxScroll);
        return;
      }

      if (!pointer.isDown || !this.contentDragState) return;
      const deltaY = world.y - this.contentDragState.startWorldY;
      if (!this.contentDragState.active) {
        if (Math.abs(deltaY) < this.dragThreshold) return;
        this.contentDragState.active = true;
      }
      this.updateScroll(this.contentDragState.startScroll - deltaY);
    };
    this.pointerUpHandler = () => {
      this.thumbDragState = undefined;
      this.contentDragState = undefined;
    };
    this.scene.input.on("wheel", this.wheelHandler);
    this.scene.input.on("pointerdown", this.pointerDownHandler);
    this.scene.input.on("pointermove", this.pointerMoveHandler);
    this.scene.input.on("pointerup", this.pointerUpHandler);
  }

  destroy() {
    this.detach();
    this.maskShape?.destroy();
    this.scrollbarTrack?.destroy();
    this.scrollbarThumb?.destroy();
    this.maskShape = undefined;
    this.scrollbarTrack = undefined;
    this.scrollbarThumb = undefined;
  }

  private detach() {
    if (this.wheelHandler) {
      this.scene.input.off("wheel", this.wheelHandler);
      this.wheelHandler = undefined;
    }
    if (this.pointerDownHandler) {
      this.scene.input.off("pointerdown", this.pointerDownHandler);
      this.pointerDownHandler = undefined;
    }
    if (this.pointerMoveHandler) {
      this.scene.input.off("pointermove", this.pointerMoveHandler);
      this.pointerMoveHandler = undefined;
    }
    if (this.pointerUpHandler) {
      this.scene.input.off("pointerup", this.pointerUpHandler);
      this.pointerUpHandler = undefined;
    }
    this.thumbDragState = undefined;
    this.contentDragState = undefined;
  }

  private updateScroll(next: number) {
    this.scrollY = Phaser.Math.Clamp(next, 0, this.maxScroll);
    this.content.setY(-this.scrollY);
    if (!this.scrollbarThumb) return;
    const trackHeight = this.bounds.height;
    const thumbHeight = this.scrollbarThumb.height;
    const range = trackHeight - thumbHeight;
    const ratio = this.maxScroll > 0 ? this.scrollY / this.maxScroll : 0;
    this.scrollbarThumb.setY(this.bounds.y + thumbHeight / 2 + range * ratio);
  }

  private createMask() {
    this.maskShape = this.scene.add.graphics();
    this.maskShape.fillStyle(0xffffff, 1);
    this.maskShape.fillRect(
      this.container.x + this.bounds.x,
      this.container.y + this.bounds.y,
      this.bounds.width,
      this.bounds.height,
    );
    this.maskShape.setVisible(false);
    this.content.setMask(this.maskShape.createGeometryMask());
  }

  private updateScrollbar() {
    this.scrollbarTrack?.destroy();
    this.scrollbarThumb?.destroy();
    this.scrollbarTrack = undefined;
    this.scrollbarThumb = undefined;
    if (this.maxScroll <= 0) return;

    const track = this.scene.add.rectangle(
      this.scrollbar.trackX,
      this.bounds.y + this.bounds.height / 2,
      this.scrollbar.width,
      this.bounds.height,
      0x000000,
      0.25,
    );
    const thumbHeight = Math.max(
      this.scrollbar.minThumb,
      this.bounds.height * (this.bounds.height / (this.bounds.height + this.maxScroll)),
    );
    const thumb = this.scene.add.rectangle(
      this.scrollbar.trackX,
      this.bounds.y + thumbHeight / 2,
      this.scrollbar.width,
      thumbHeight,
      0xffffff,
      0.5,
    );
    thumb.setInteractive({ useHandCursor: true });
    thumb.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      const world = this.getPointerWorld(pointer);
      this.thumbDragState = { startWorldY: world.y, startScroll: this.scrollY };
    });
    this.container.add(track);
    this.container.add(thumb);
    this.scrollbarTrack = track;
    this.scrollbarThumb = thumb;
  }

  private getPointerWorld(pointer: Phaser.Input.Pointer) {
    const cam = this.scene.cameras.main;
    return cam.getWorldPoint(pointer.x, pointer.y);
  }

  private isPointerOnThumb(pointer: Phaser.Input.Pointer) {
    if (!this.scrollbarThumb) return false;
    const world = this.getPointerWorld(pointer);
    const bounds = this.scrollbarThumb.getBounds();
    return bounds.contains(world.x, world.y);
  }

  private isPointerInScrollArea(pointer: Phaser.Input.Pointer) {
    const world = this.getPointerWorld(pointer);
    const left = this.container.x + this.bounds.x;
    const top = this.container.y + this.bounds.y;
    return (
      world.x >= left &&
      world.x <= left + this.bounds.width &&
      world.y >= top &&
      world.y <= top + this.bounds.height
    );
  }
}
