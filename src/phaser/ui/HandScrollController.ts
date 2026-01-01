import Phaser from "phaser";
import type { HandLayoutState } from "./HandLayout";

export type HandScrollDeps = {
  getMaskRect: () => Phaser.Geom.Rectangle | undefined;
  applyScrollX: (value: number) => void;
  updateArrows: (scrollX: number, minScrollX: number, maxScrollX: number) => void;
  onDragSuppress?: () => void;
};

export type HandScrollConfig = {
  duration: number;
};

export class HandScrollController {
  private layoutState?: HandLayoutState;
  private scrollX = 0;
  private scrollTween?: Phaser.Tweens.Tween;
  private scrollDriver = { x: 0 };
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
  private onWheel?: (pointer: Phaser.Input.Pointer, go: any, dx: number, dy: number) => void;
  private onPointerDown?: (pointer: Phaser.Input.Pointer) => void;
  private onPointerMove?: (pointer: Phaser.Input.Pointer) => void;
  private onPointerUp?: () => void;
  private onPointerUpOutside?: () => void;
  private onUpdate?: (_time: number, delta: number) => void;

  constructor(private scene: Phaser.Scene, private config: HandScrollConfig, private deps: HandScrollDeps) {}

  setLayout(state: HandLayoutState) {
    this.layoutState = state;
    this.scrollX = Phaser.Math.Clamp(this.scrollX, state.minScrollX, state.maxScrollX);
    this.scrollDriver.x = this.scrollX;
    this.deps.applyScrollX(this.scrollX);
    this.updateArrows();
  }

  getScrollX() {
    return this.scrollX;
  }

  getDragSuppressClick() {
    return this.dragSuppressClick;
  }

  resetDragSuppressClick() {
    this.dragSuppressClick = false;
  }

  bind() {
    this.bindWheelScroll();
    this.bindDragScroll();
    this.bindInertiaTick();
  }

  scrollByStep(direction: -1 | 1) {
    if (!this.layoutState) return;
    const step = (this.layoutState.cardW + this.layoutState.gapX) * direction;
    this.scrollTo(this.scrollX - step);
  }

  scrollTo(targetX: number) {
    if (!this.layoutState) return;
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

  destroy() {
    if (this.wheelBound) {
      if (this.onWheel) this.scene.input.off("wheel", this.onWheel);
      this.wheelBound = false;
    }
    if (this.dragBound) {
      if (this.onPointerDown) this.scene.input.off("pointerdown", this.onPointerDown);
      if (this.onPointerMove) this.scene.input.off("pointermove", this.onPointerMove);
      if (this.onPointerUp) this.scene.input.off("pointerup", this.onPointerUp);
      if (this.onPointerUpOutside) this.scene.input.off("pointerupoutside", this.onPointerUpOutside);
      this.dragBound = false;
    }
    if (this.updateBound) {
      if (this.onUpdate) this.scene.events.off("update", this.onUpdate);
      this.updateBound = false;
    }
    this.scrollTween?.stop();
  }

  private updateArrows() {
    if (!this.layoutState) return;
    this.deps.updateArrows(this.scrollX, this.layoutState.minScrollX, this.layoutState.maxScrollX);
  }

  private applyScrollX(next: number) {
    if (!this.layoutState) return;
    this.scrollX = Phaser.Math.Clamp(next, this.layoutState.minScrollX, this.layoutState.maxScrollX);
    this.deps.applyScrollX(this.scrollX);
  }

  private bindWheelScroll() {
    if (this.wheelBound) return;
    this.wheelBound = true;
    this.onWheel = (_pointer: Phaser.Input.Pointer, _go: any, dx: number, dy: number) => {
      if (!this.layoutState) return;
      const maskRect = this.deps.getMaskRect();
      if (!maskRect) return;
      const pointer = this.scene.input.activePointer;
      if (!maskRect.contains(pointer.x, pointer.y)) return;
      const delta = dx !== 0 ? dx : dy;
      if (delta === 0) return;
      const stepCap = this.layoutState.cardW + this.layoutState.gapX;
      const clampedDelta = Phaser.Math.Clamp(delta, -stepCap, stepCap);
      this.scrollTo(this.scrollX - clampedDelta);
    };
    this.scene.input.on("wheel", this.onWheel);
  }

  private bindDragScroll() {
    if (this.dragBound) return;
    this.dragBound = true;
    this.onPointerDown = (pointer: Phaser.Input.Pointer) => {
      if (!this.layoutState) return;
      const maskRect = this.deps.getMaskRect();
      if (!maskRect) return;
      if (!maskRect.contains(pointer.x, pointer.y)) return;
      this.dragActive = true;
      this.dragSuppressClick = false;
      this.dragStartX = pointer.x;
      this.dragLastX = pointer.x;
      this.dragLastTime = this.scene.time.now;
      this.dragVelocity = 0;
      this.inertiaActive = false;
      this.scrollTween?.stop();
    };
    this.onPointerMove = (pointer: Phaser.Input.Pointer) => {
      if (!this.dragActive || !this.layoutState) return;
      const now = this.scene.time.now;
      const dx = pointer.x - this.dragLastX;
      const dt = Math.max(1, now - this.dragLastTime);
      if (Math.abs(pointer.x - this.dragStartX) > 4) {
        if (!this.dragSuppressClick) {
          this.dragSuppressClick = true;
          this.deps.onDragSuppress?.();
        }
      }
      const next = Phaser.Math.Clamp(this.scrollX + dx, this.layoutState.minScrollX, this.layoutState.maxScrollX);
      this.applyScrollX(next);
      this.dragVelocity = dx / dt;
      this.dragLastX = pointer.x;
      this.dragLastTime = now;
      this.updateArrows();
    };
    this.onPointerUp = () => this.stopDrag();
    this.onPointerUpOutside = () => this.stopDrag();
    this.scene.input.on("pointerdown", this.onPointerDown);
    this.scene.input.on("pointermove", this.onPointerMove);
    this.scene.input.on("pointerup", this.onPointerUp);
    this.scene.input.on("pointerupoutside", this.onPointerUpOutside);
  }

  private stopDrag() {
    if (!this.dragActive) return;
    this.dragActive = false;
    const speed = this.dragVelocity;
    if (Math.abs(speed) > 0.02) {
      this.startInertia(speed);
    }
  }

  private bindInertiaTick() {
    if (this.updateBound) return;
    this.updateBound = true;
    this.onUpdate = (_time: number, delta: number) => {
      if (!this.inertiaActive || !this.layoutState) return;
      const dt = Math.max(1, delta);
      const next = this.scrollX + this.dragVelocity * dt;
      const clamped = Phaser.Math.Clamp(next, this.layoutState.minScrollX, this.layoutState.maxScrollX);
      this.applyScrollX(clamped);
      const friction = Math.pow(0.92, dt / 16.67);
      this.dragVelocity *= friction;
      if (this.scrollX === this.layoutState.minScrollX || this.scrollX === this.layoutState.maxScrollX) {
        this.dragVelocity = 0;
      }
      if (Math.abs(this.dragVelocity) < 0.01) {
        this.inertiaActive = false;
        this.dragVelocity = 0;
      }
      this.updateArrows();
    };
    this.scene.events.on("update", this.onUpdate);
  }

  private startInertia(speed: number) {
    this.inertiaActive = true;
    this.dragVelocity = speed;
  }
}
