import Phaser from "phaser";
import { BASE_H, HAND_AREA_HEIGHT, INTERNAL_W } from "../../config/gameLayout";
import { UI_LAYOUT } from "./UiLayoutConfig";
import { toColor } from "./types";

type ActionButtonConfig = {
  label: string;
  onClick?: () => void;
  enabled?: boolean;
  primary?: boolean;
};
type ActionBarState = {
  descriptors: ActionButtonConfig[];
};

export class ActionButtonBarHandler {
  private barHeight = 40;
  private state: ActionBarState = {
    descriptors: [],
  };
  private hitAreas: Phaser.GameObjects.Rectangle[] = [];
  private elements: Phaser.GameObjects.GameObject[] = [];
  private onAction: (index: number) => void = () => {};
  private lastOffset: { x: number; y: number } = { x: 0, y: 0 };
  private waitingLabel?: Phaser.GameObjects.Text;
  private waitingTween?: Phaser.Tweens.Tween;
  private waitingMode = false;
  private waitingOverride: ActionButtonConfig[] | null = null;
  private waitingOverrideKey = "";
  private visible = true;
  private background?: Phaser.GameObjects.GameObject;
  private waitingLabelText = "Waiting for opponent...";
  private buttonContainer?: Phaser.GameObjects.Container;
  private maskShape?: Phaser.GameObjects.Graphics;
  private maskRect?: Phaser.Geom.Rectangle;
  private leftArrow?: Phaser.GameObjects.Container;
  private rightArrow?: Phaser.GameObjects.Container;

  private scrollBound = false;
  private scrollLayout?: {
    viewX: number;
    viewY: number;
    viewW: number;
    viewH: number;
    minX: number;
    maxX: number;
    step: number;
    canScroll: boolean;
    defaultX: number;
  };
  private scrollX = 0;
  private dragActive = false;
  private dragStartX = 0;
  private dragLastX = 0;
  private dragLastTime = 0;
  private dragVelocity = 0;
  private dragSuppressClick = false;
  private inertiaActive = false;
  private onWheel?: (pointer: Phaser.Input.Pointer, go: any, dx: number, dy: number) => void;
  private onPointerDown?: (pointer: Phaser.Input.Pointer) => void;
  private onPointerMove?: (pointer: Phaser.Input.Pointer) => void;
  private onPointerUp?: () => void;
  private onPointerUpOutside?: () => void;
  private onUpdate?: (_time: number, delta: number) => void;
  private lastScrollKey = "";

  // Mirrors HandAreaHandler layout so the bar can sit just above the hand.
  private handLayout = {
    cardH: HAND_AREA_HEIGHT - UI_LAYOUT.hand.bar.cardHOffset,
    gap: UI_LAYOUT.hand.bar.gap,
    rows: UI_LAYOUT.hand.bar.rows,
    bottomPadding: UI_LAYOUT.hand.bar.bottomPadding,
  };
  private buttonStyle = {
    outerColor: 0x2f6ad9,
    outerStroke: 0x1f4f9c,
    innerColor: 0xf2f5ff,
    innerStroke: 0xffffff,
    textColor: "#1f3f9c",
    endOuterColor: 0x1e7bff,
  };
  private buttonTextStyle = {
    fontSize: "15px",
    fontFamily: "Arial",
    fontStyle: "bold" as const,
  };

  constructor(private scene: Phaser.Scene) {}

  setActionHandler(handler: (index: number) => void) {
    this.onAction = handler;
  }

  setButtons(labels: string[]) {
    void labels;
    this.draw(this.lastOffset);
  }

  setPinnedButtons(buttons: ActionButtonConfig[]) {
    this.setDescriptors(buttons);
  }

  setState(next: Partial<ActionBarState>) {
    this.state = {
      descriptors: next.descriptors ?? this.state.descriptors,
    };
    this.draw(this.lastOffset);
  }

  setDescriptors(buttons: ActionButtonConfig[]) {
    const normalized = buttons.map((b, idx) => ({
      label: String(b?.label ?? `Action ${idx + 1}`),
      onClick: b?.onClick ?? (() => {}),
      enabled: b?.enabled ?? true,
      primary: (b as any)?.primary ?? false,
    }));
    this.setState({ descriptors: normalized });
  }

  setWaitingForOpponent(waiting: boolean, overrideButtons?: ActionButtonConfig[]) {
    const nextOverride = overrideButtons?.length ? overrideButtons : null;
    const nextOverrideKey = nextOverride
      ? nextOverride
          .map((btn) => `${String(btn?.label ?? "")}:${btn?.enabled ?? true}:${(btn as any)?.primary ?? false}`)
          .join("|")
      : "";
    if (this.waitingMode === waiting && this.waitingOverrideKey === nextOverrideKey) {
      return;
    }
    this.waitingMode = waiting;
    this.waitingOverride = nextOverride;
    this.waitingOverrideKey = nextOverrideKey;
    this.draw(this.lastOffset);
  }

  setWaitingLabel(label: string) {
    const nextLabel = label || "Waiting for opponent...";
    if (this.waitingLabelText === nextLabel) return;
    this.waitingLabelText = nextLabel;
    if (this.waitingMode) {
      this.draw(this.lastOffset);
    }
  }

  setVisible(visible: boolean) {
    this.visible = visible;
    // Keep the background panel visible; only hide the buttons/label above the hand.
    this.elements.forEach((e) => {
      if (e === this.background) return;
      (e as any).setVisible?.(visible);
    });
    this.hitAreas.forEach((h) => {
      h.setVisible(visible);
      if (visible) {
        h.setInteractive({ useHandCursor: true });
      } else {
        h.disableInteractive();
      }
    });
    this.waitingLabel?.setVisible(visible);
  }

  fadeIn(duration = 200) {
    this.setVisible(true);
    const tweenTargets = this.elements.filter((e) => typeof (e as any).setAlpha === "function");
    tweenTargets.forEach((t) => (t as any).setAlpha?.(0));
    if (tweenTargets.length) {
      this.scene.tweens.add({ targets: tweenTargets as any, alpha: 1, duration, ease: "Sine.easeOut" });
    }
  }

  draw(offset: { x: number; y: number }) {
    this.ensureScrollBindings();
    this.lastOffset = offset;
    this.elements.forEach((e) => e.destroy());
    this.elements = [];
    this.buttonContainer = undefined;
    this.maskShape = undefined;
    this.maskRect = undefined;
    this.leftArrow = undefined;
    this.rightArrow = undefined;
    this.hitAreas.forEach((h) => h.destroy());
    this.hitAreas = [];

    // Geometry and positioning.
    const { cardH, gap, rows, bottomPadding } = this.handLayout;
    const totalHandHeight = rows * cardH + (rows - 1) * gap ;
    const handTop = BASE_H - bottomPadding - totalHandHeight + offset.y;
    const barY = handTop - this.barHeight / 2 - 3 ;
    const camW = this.scene.scale.width;
    const barX = camW / 2;
    const btnGap = 12;
    const btnHeight = this.barHeight;
    const bgHeight = HAND_AREA_HEIGHT + 120;
    const viewX = 0;
    const viewW = camW;
    const viewY = barY - btnHeight / 2;
    const viewH = btnHeight;

    // Always draw the background bar.
    const bg = this.drawRoundedRectOrigin({
      x: 0,
      y: barY - 25,
      width: camW,
      height: bgHeight,
      radius: 0,
      fillColor: "#414242",
      fillAlpha: 1,
      strokeColor: 0x5e48f0,
      strokeAlpha: 0,
      strokeWidth: 0,
    }).setDepth(0);
    this.elements.push(bg);
    this.background = bg;
    bg.setVisible(true);

    // Solid strip behind buttons (keeps the bar grey even when the rest of the panel is clipped/changed).
    const stripBg = this.drawRoundedRectOrigin({
      x: viewX,
      y: viewY - 6,
      width: viewW,
      height: viewH + 12,
      radius: 0,
      fillColor: "#414242",
      fillAlpha: 1,
      strokeColor: 0x5e48f0,
      strokeAlpha: 0,
      strokeWidth: 0,
    }).setDepth(850);
    this.elements.push(stripBg);

    this.waitingLabel?.destroy();
    this.waitingTween?.remove();
    if (this.waitingMode && !this.waitingOverride) {
      this.drawWaitingLabel(barY);
      this.setVisible(this.visible);
      return;
    }

    // Build buttons to render (hide pinned if blank/disabled).
    const renderButtons: Array<{ config: ActionButtonConfig; color: number; actionIndex: number | null }> = [];
    const sourceDescriptors = this.waitingOverride ?? this.state.descriptors;
    const nextScrollKey = sourceDescriptors
      .map((btn) => `${String(btn?.label ?? "")}:${btn?.enabled ?? true}:${(btn as any)?.primary ?? false}`)
      .join("|");
    sourceDescriptors.forEach((btn) => {
      if (!btn.label || !btn.label.trim() || btn.enabled === false) return;
      const color = btn.primary ? this.buttonStyle.endOuterColor : 0x5e48f0;
      renderButtons.push({ config: btn, color, actionIndex: null });
    });

    if (!renderButtons.length) {
      return;
    }

    const buttonsWithSize = renderButtons.map((btn) => {
      const temp = this.scene.add
        .text(0, 0, btn.config.label || "", this.buttonTextStyle)
        .setOrigin(0.5)
        .setVisible(false);
      const width = Math.max(110, temp.width + 32);
      temp.destroy();
      return { ...btn, width };
    });

    const totalButtonsWidth = buttonsWithSize.reduce((sum, btn) => sum + btn.width, 0);
    const totalWidth = totalButtonsWidth + btnGap * (buttonsWithSize.length - 1);
    const canScroll = totalWidth > viewW + 1;
    // When content fits, keep scroll at 0 and center content within the viewport.
    const contentStartX = canScroll ? 0 : (viewW - totalWidth) / 2;
    // When content overflows, allow scrolling the container between [minX, maxX].
    const minX = canScroll ? Math.min(0, viewW - totalWidth) : 0;
    const maxX = canScroll ? 0 : 0;
    // Default overflow position is centered across the full content width.
    const defaultX = canScroll ? (minX + maxX) / 2 : 0;
    const step = 170;
    this.scrollLayout = { viewX, viewY, viewW, viewH, minX, maxX, step, canScroll, defaultX };
    const shouldReset = this.lastScrollKey !== nextScrollKey;
    this.lastScrollKey = nextScrollKey;
    this.scrollX = Phaser.Math.Clamp(shouldReset ? defaultX : this.scrollX, minX, maxX);
    this.updateMask(viewX, viewY, viewW, viewH);
    this.updateArrows();

    this.buttonContainer?.destroy();
    this.buttonContainer = this.scene.add.container(viewX + this.scrollX, 0).setDepth(900);
    this.elements.push(this.buttonContainer);
    if (this.maskShape && !this.buttonContainer.mask) {
      this.buttonContainer.setMask(this.maskShape.createGeometryMask());
    }

    let currentX = contentStartX;

    buttonsWithSize.forEach((btn) => {
      const x = currentX + btn.width / 2;
      this.drawButton(x, barY, btn.width, btnHeight, btn.config, 900, btn.color, btn.actionIndex, this.buttonContainer);
      currentX += btn.width + btnGap;
    });
    this.setVisible(this.visible);
  }

  private drawRoundedRect(config: {
    x: number;
    y: number;
    width: number;
    height: number;
    radius: number;
    fillColor: number | string;
    fillAlpha?: number;
    strokeColor?: number | string;
    strokeAlpha?: number;
    strokeWidth?: number;
  }) {
    const {
      x,
      y,
      width,
      height,
      radius,
      fillColor,
      fillAlpha = 1,
      strokeColor,
      strokeAlpha = 1,
      strokeWidth = 0,
    } = config;
    const g = this.scene.add.graphics({ x: x - width / 2, y: y - height / 2 });
    g.fillStyle(toColor(fillColor), fillAlpha);
    g.fillRoundedRect(0, 0, width, height, radius);
    if (strokeWidth > 0 && strokeColor !== undefined) {
      g.lineStyle(strokeWidth, toColor(strokeColor), strokeAlpha);
      g.strokeRoundedRect(0, 0, width, height, radius);
    }
    return g;
  }

  private drawRoundedRectOrigin(config: {
    x: number;
    y: number;
    width: number;
    height: number;
    radius: number;
    fillColor: number | string;
    fillAlpha?: number;
    strokeColor?: number | string;
    strokeAlpha?: number;
    strokeWidth?: number;
  }) {
    const {
      x,
      y,
      width,
      height,
      radius,
      fillColor,
      fillAlpha = 1,
      strokeColor,
      strokeAlpha = 1,
      strokeWidth = 0,
    } = config;
    const g = this.scene.add.graphics({ x, y });
    g.fillStyle(toColor(fillColor), fillAlpha);
    g.fillRoundedRect(0, 0, width, height, radius);
    if (strokeWidth > 0 && strokeColor !== undefined) {
      g.lineStyle(strokeWidth, toColor(strokeColor), strokeAlpha);
      g.strokeRoundedRect(0, 0, width, height, radius);
    }
    return g;
  }

  private drawButton(
    x: number,
    y: number,
    w: number,
    h: number,
    config: ActionButtonConfig,
    depth: number,
    fillColor: number,
    actionIndex: number | null,
    container?: Phaser.GameObjects.Container,
  ) {
    const enabled = config.enabled !== false;
    // Outer pill
    const outer = this.drawRoundedRect({
      x,
      y,
      width: w,
      height: h,
      radius: h / 2,
      fillColor,
      fillAlpha: enabled ? 1 : 0.4,
      strokeColor: this.buttonStyle.outerStroke,
      strokeAlpha: 0.8,
      strokeWidth: 2,
    }).setDepth(depth);
    if (container) container.add(outer);
    this.elements.push(outer);

    // Inner pill inset
    const inner = this.drawRoundedRect({
      x,
      y,
      width: w - 10,
      height: h - 12,
      radius: (h - 12) / 2,
      fillColor: this.buttonStyle.innerColor,
      fillAlpha: enabled ? 1 : 0.6,
      strokeColor: this.buttonStyle.innerStroke,
      strokeAlpha: 0.6,
      strokeWidth: 1,
    }).setDepth(depth + 1);
    if (container) container.add(inner);
    this.elements.push(inner);

    const textStyle = {
      ...this.buttonTextStyle,
      color: enabled ? this.buttonStyle.textColor : "#8a9abf",
    };
    const text = this.scene
      .add.text(x, y, String(config.label || ""), textStyle)
      .setOrigin(0.5)
      .setDepth(depth + 2);
    if (container) container.add(text);
    this.elements.push(text);

    const hit = this.scene.add
      .rectangle(x, y, w, h, 0x000000, 0)
      .setInteractive({ useHandCursor: enabled })
      .setDepth(depth + 3);
    hit.on("pointerup", (_pointer: any, _localX: number, _localY: number, event: any) => {
      if (!enabled) return;
      if (this.dragSuppressClick) {
        this.dragSuppressClick = false;
        return;
      }
      // Prevent underlying interactive game objects (hand/slots) from also receiving this click.
      event?.stopPropagation?.();
      if (actionIndex !== null) {
        this.onAction(actionIndex);
      }
      config.onClick?.();
    });
    this.hitAreas.push(hit);
    if (container) container.add(hit);
    this.elements.push(hit);
  }

  private ensureScrollBindings() {
    if (this.scrollBound) return;
    this.scrollBound = true;

    this.onWheel = (_pointer: Phaser.Input.Pointer, _go: any, dx: number, dy: number) => {
      const layout = this.scrollLayout;
      if (!layout || !layout.canScroll || !this.maskRect) return;
      const pointer = this.scene.input.activePointer;
      if (!this.maskRect.contains(pointer.x, pointer.y)) return;
      const delta = dx !== 0 ? dx : dy;
      if (delta === 0) return;
      const stepCap = layout.step;
      const clampedDelta = Phaser.Math.Clamp(delta, -stepCap, stepCap);
      this.scrollTo(this.scrollX - clampedDelta);
    };
    this.scene.input.on("wheel", this.onWheel);

    this.onPointerDown = (pointer: Phaser.Input.Pointer) => {
      const layout = this.scrollLayout;
      if (!layout || !layout.canScroll || !this.maskRect) return;
      if (!this.maskRect.contains(pointer.x, pointer.y)) return;
      this.dragActive = true;
      this.dragSuppressClick = false;
      this.dragStartX = pointer.x;
      this.dragLastX = pointer.x;
      this.dragLastTime = this.scene.time.now;
      this.dragVelocity = 0;
      this.inertiaActive = false;
    };
    this.onPointerMove = (pointer: Phaser.Input.Pointer) => {
      const layout = this.scrollLayout;
      if (!this.dragActive || !layout) return;
      const now = this.scene.time.now;
      const dx = pointer.x - this.dragLastX;
      const dt = Math.max(1, now - this.dragLastTime);
      if (Math.abs(pointer.x - this.dragStartX) > 4) {
        this.dragSuppressClick = true;
      }
      this.scrollTo(this.scrollX + dx, { animate: false });
      this.dragVelocity = dx / dt;
      this.dragLastX = pointer.x;
      this.dragLastTime = now;
    };
    const stopDrag = () => {
      if (!this.dragActive) return;
      this.dragActive = false;
      if (Math.abs(this.dragVelocity) > 0.02) {
        this.inertiaActive = true;
      }
    };
    this.onPointerUp = () => stopDrag();
    this.onPointerUpOutside = () => stopDrag();
    this.scene.input.on("pointerdown", this.onPointerDown);
    this.scene.input.on("pointermove", this.onPointerMove);
    this.scene.input.on("pointerup", this.onPointerUp);
    this.scene.input.on("pointerupoutside", this.onPointerUpOutside);

    this.onUpdate = (_time: number, delta: number) => {
      const layout = this.scrollLayout;
      if (!this.inertiaActive || !layout || !layout.canScroll) return;
      const dt = Math.max(1, delta);
      this.scrollTo(this.scrollX + this.dragVelocity * dt, { animate: false });
      const friction = Math.pow(0.92, dt / 16.67);
      this.dragVelocity *= friction;
      if (this.scrollX === layout.minX || this.scrollX === layout.maxX) {
        this.dragVelocity = 0;
      }
      if (Math.abs(this.dragVelocity) < 0.01) {
        this.inertiaActive = false;
        this.dragVelocity = 0;
      }
    };
    this.scene.events.on("update", this.onUpdate);
  }

  private scrollTo(targetX: number, opts: { animate?: boolean } = {}) {
    const layout = this.scrollLayout;
    if (!layout) return;
    const clamped = Phaser.Math.Clamp(targetX, layout.minX, layout.maxX);
    this.scrollX = clamped;
    this.applyScrollX();
    this.updateArrows();
    void opts;
  }

  private applyScrollX() {
    if (!this.scrollLayout || !this.buttonContainer) return;
    this.buttonContainer.setX(this.scrollLayout.viewX + this.scrollX);
  }

  private updateMask(viewX: number, viewY: number, viewW: number, viewH: number) {
    if (!this.maskShape) {
      this.maskShape = this.scene.add.graphics().setVisible(false);
      this.elements.push(this.maskShape);
    }
    this.maskShape.clear();
    this.maskShape.fillStyle(0xffffff, 1);
    this.maskShape.fillRect(viewX, viewY, viewW, viewH);
    this.maskRect = new Phaser.Geom.Rectangle(viewX, viewY, viewW, viewH);
  }

  private updateArrows() {
    // Always hide arrows for action bar; scrolling is via drag/wheel only.
    if (this.leftArrow) this.leftArrow.setVisible(false);
    if (this.rightArrow) this.rightArrow.setVisible(false);
  }

  private drawWaitingLabel(y: number) {
    this.waitingLabel?.destroy();
    this.waitingLabel = this.scene
      .add
      .text(INTERNAL_W / 2, y, this.waitingLabelText, {
        fontSize: "16px",
        fontFamily: "Arial",
        color: "#ffffff",
      })
      .setOrigin(0.5)
      .setDepth(900);
    this.elements.push(this.waitingLabel);
    this.waitingTween?.remove();
    this.waitingTween = this.scene.tweens.add({
      targets: this.waitingLabel,
      alpha: 0.3,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }
}
