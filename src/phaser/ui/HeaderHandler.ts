import Phaser from "phaser";
import { BASE_W } from "../../config/gameLayout";
import { Offset, Palette, RoundedRectConfig, toColor } from "./types";
import { TimerBar } from "./TimerBar";
import { HEADER_TIMER_BAR_STYLE } from "./timerBarStyles";
import { HEADER_WAITING_THEME } from "./style/WaitingDialogTheme";

// Shared frame styling used by BoardUI.
export const FRAME_STYLE: Pick<RoundedRectConfig, "radius" | "fillAlpha" | "strokeColor" | "strokeAlpha" | "strokeWidth"> = {
  radius: 18,
  fillAlpha: 0.98,
  strokeColor: "#ffffff",
  strokeAlpha: 0,
  strokeWidth: 0,
};

// Shared drawing helpers for UI shapes.
export class DrawHelpers {
  constructor(private scene: Phaser.Scene) {}

  drawRoundedRect(config: RoundedRectConfig) {
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

  drawRoundedRectOrigin(config: RoundedRectConfig) {
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
    const g = this.scene.add.graphics({ x: x, y: y});
    g.fillStyle(toColor(fillColor), fillAlpha);
    g.fillRoundedRect(0, 0, width, height, radius);
    if (strokeWidth > 0 && strokeColor !== undefined) {
      g.lineStyle(strokeWidth, toColor(strokeColor), strokeAlpha);
      g.strokeRoundedRect(0, 0, width, height, radius);
    }
    return g;
  }

  toColor(value: number | string) {
    return toColor(value);
  }
}

type HeaderLayout = { height: number; padding: number; menuButton: number };
type HeaderState = { handCount: number; opponentHand?: number | string };
type LoadingVisualVariant = "orbital" | "minimalDots" | "softPulse";

const HEADER_BG_ALPHA = 1;
const LOADING_VISUAL_VARIANT: LoadingVisualVariant = "softPulse";
const HEADER_THEME = HEADER_WAITING_THEME;

export class HeaderHandler {
  private layout: HeaderLayout = { height: 60, padding: 10, menuButton: 45 };
  private state: HeaderState = { handCount: 8, opponentHand: "-" };
  private depth = 1000;
  private statusLabel?: Phaser.GameObjects.Text;
  private turnLabel?: Phaser.GameObjects.Text;
  private menuHit?: Phaser.GameObjects.Rectangle;
  private menuIcon?: Phaser.GameObjects.Graphics;
  private onMenu?: () => void;
  private handLabel?: Phaser.GameObjects.Text;
  private timerBar?: TimerBar;
  private loadingContainer?: Phaser.GameObjects.Container;
  private loadingBg?: Phaser.GameObjects.Rectangle;
  private loadingIndicator?: Phaser.GameObjects.Container;
  private loadingIndicatorNodes: Phaser.GameObjects.GameObject[] = [];
  private loadingIndicatorTweens: Phaser.Tweens.Tween[] = [];
  private loadingLabel?: Phaser.GameObjects.Text;
  private readonly loadingVariant: LoadingVisualVariant = LOADING_VISUAL_VARIANT;
  private loadingPulseTween?: Phaser.Tweens.Tween;
  private loadingLabelTween?: Phaser.Tweens.Tween;
  private loadingDotsTimer?: Phaser.Time.TimerEvent;
  private loadingDotsFrame = 0;
  private interactionLoadingVisible = false;
  private interactionLoadingLabel = "Processing";

  constructor(private scene: Phaser.Scene, private palette: Palette, private drawHelpers: DrawHelpers) {}

  draw(offset: Offset) {
    const { height, padding, menuButton } = this.layout;
    const { handCount, opponentHand } = this.state;

    const containerW = BASE_W;
    const containerX = BASE_W / 2 + offset.x;
    // Pin header to the very top of the play area (no vertical padding).
    const containerY = height / 2 + offset.y;
    const containerLeft = containerX - containerW / 2;
    const containerRight = containerX + containerW / 2;
    const containerTop = containerY - height / 2;

    const highlightH = Math.round(height * 0.46);
    const sheenH = Math.round(height * 0.22);
    const bottomShadeH = Math.round(height * 0.30);
    const lineColor = this.drawHelpers.toColor(HEADER_THEME.bottomLine);

    this.drawHelpers.drawRoundedRect({
      x: containerX,
      y: containerY,
      width: containerW,
      height,
      radius: 0,
      fillColor: HEADER_THEME.base,
      fillAlpha: HEADER_BG_ALPHA * 0.96,
      strokeColor: this.palette.ink,
      strokeAlpha: 0,
      strokeWidth: 0,
    }).setDepth(this.depth);
    this.drawHelpers.drawRoundedRectOrigin({
      x: containerLeft,
      y: containerTop,
      width: containerW,
      height: highlightH,
      radius: 0,
      fillColor: HEADER_THEME.topGlow,
      fillAlpha: 0.22,
      strokeWidth: 0,
    }).setDepth(this.depth + 1);
    this.drawHelpers.drawRoundedRectOrigin({
      x: containerLeft,
      y: containerTop + 4,
      width: containerW,
      height: sheenH,
      radius: 0,
      fillColor: HEADER_THEME.glassSheen,
      fillAlpha: 0.08,
      strokeWidth: 0,
    }).setDepth(this.depth + 2);
    this.drawHelpers.drawRoundedRectOrigin({
      x: containerLeft,
      y: containerTop + height - bottomShadeH,
      width: containerW,
      height: bottomShadeH,
      radius: 0,
      fillColor: HEADER_THEME.bottomShade,
      fillAlpha: 0.56,
      strokeWidth: 0,
    }).setDepth(this.depth + 1);
    this.scene.add
      .rectangle(containerX, containerTop + height - 1, containerW, 2, lineColor, 0.72)
      .setDepth(this.depth + 2);

    // Left menu button
    const menuX = containerLeft + padding + menuButton / 2 + (BASE_W - 400) / 2;
    const menuY = containerY;
    this.drawHelpers.drawRoundedRect({
      x: menuX,
      y: menuY,
      width: menuButton + 6,
      height: menuButton + 6,
      radius: 10,
      fillColor: HEADER_THEME.menuHalo,
      fillAlpha: 0.12,
      strokeWidth: 0,
    }).setDepth(this.depth + 1);
    this.drawHelpers.drawRoundedRect({
      x: menuX,
      y: menuY,
      width: menuButton,
      height: menuButton,
      radius: 8,
      fillColor: HEADER_THEME.menuFill,
      fillAlpha: 0.96,
      strokeColor: HEADER_THEME.menuStroke,
      strokeAlpha: 0.95,
      strokeWidth: 2,
    }).setDepth(this.depth + 2);
    this.drawHelpers.drawRoundedRectOrigin({
      x: menuX - menuButton / 2 + 2,
      y: menuY - menuButton / 2 + 2,
      width: menuButton - 4,
      height: Math.round((menuButton - 4) * 0.45),
      radius: 6,
      fillColor: HEADER_THEME.menuSheen,
      fillAlpha: 0.12,
      strokeWidth: 0,
    }).setDepth(this.depth + 3);
    this.drawMenuIcon(menuX, menuY, menuButton);
    this.drawMenuHit(menuX, menuY, menuButton, menuButton);

    const turnTextX = containerRight - 12;
    const turnY = containerY + 2;

    // Opponent hand under turn label in the top-right info stack.
    const handTextX = turnTextX;
    const handY = turnY + 18;
    const handLabel = opponentHand !== undefined ? opponentHand : handCount;
    const handDisplay = handLabel === null || handLabel === undefined || handLabel === "" ? "-" : `${handLabel}`;
    this.handLabel?.destroy();
    this.handLabel = this.scene.add
      .text(handTextX, handY, `Opponent Hand: ${handDisplay}`, {
        fontSize: "13px",
        fontFamily: "Arial",
        color: HEADER_THEME.detailText,
        stroke: HEADER_THEME.textStroke,
        strokeThickness: 2,
      })
      .setOrigin(1, 0.5)
      .setDepth(this.depth + 3);

    this.drawStatus(turnTextX, containerY - 18);
    this.drawTurnLabel(turnTextX, turnY);
    this.drawTimerBar(containerLeft, containerTop + height - 2, containerW);
    this.drawLoadingStrip(containerX, containerTop, containerW);
  }

  updateState(state: Partial<HeaderState>) {
    this.state = { ...this.state, ...state };
    this.syncLabelsFromState();
  }

  setMenuHandler(handler: () => void) {
    this.onMenu = handler;
    this.menuHit?.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.onMenu?.());
  }
  setStatusText(text: string) {
    if (!this.statusLabel) return;
    this.statusLabel.setText(text);
  }

  setTurnText(text: string, color?: string) {
    if (!this.turnLabel) return;
    this.turnLabel.setText(text);
    if (color) {
      this.turnLabel.setColor(color);
    }
  }

  setTimerProgress(progress: number, secondsLeft: number) {
    this.timerBar?.setProgress(progress, secondsLeft);
  }

  setTimerVisible(visible: boolean) {
    this.timerBar?.setVisible(visible);
  }

  setInteractionLoading(visible: boolean, label?: string) {
    this.interactionLoadingVisible = visible;
    this.interactionLoadingLabel = this.normalizeLoadingLabel(label);
    this.loadingDotsFrame = 0;
    this.syncLoadingLabel();
    this.loadingContainer?.setVisible(visible);
    if (visible) {
      this.startLoadingAnimation();
      return;
    }
    this.stopLoadingAnimation();
  }

  private drawStatus(x: number, y: number) {
    this.statusLabel?.destroy();
    this.statusLabel = this.scene.add
      .text(x, y, "Status: idle", {
        fontSize: "15px",
        fontFamily: "Arial",
        fontStyle: "bold",
        color: HEADER_THEME.statusText,
        stroke: HEADER_THEME.textStroke,
        strokeThickness: 3,
      })
      .setOrigin(1, 0.5) // Right-align so the text hugs the CTA/right edge consistently.
      .setDepth(this.depth + 3);
  }

  private drawTurnLabel(x: number, y: number) {
    this.turnLabel?.destroy();
    this.turnLabel = this.scene.add
      .text(x, y, "Turn: -", {
        fontSize: "13px",
        fontFamily: "Arial",
        color: HEADER_THEME.detailText,
        stroke: HEADER_THEME.textStroke,
        strokeThickness: 2,
      })
      .setOrigin(1, 0.5)
      .setDepth(this.depth + 3);
  }

  private drawTimerBar(x: number, y: number, width: number) {
    if (!this.timerBar) {
      this.timerBar = new TimerBar(this.scene, {
        width,
        ...HEADER_TIMER_BAR_STYLE,
      });
      this.timerBar.setVisible(false);
      this.timerBar.setDepth(this.depth + 1);
      this.timerBar.setProgress(1, 0);
    }
    this.timerBar.setPosition(x, y);
  }

  private drawLoadingStrip(centerX: number, containerTop: number, containerW: number) {
    this.stopLoadingAnimation();
    this.loadingContainer?.destroy();
    this.loadingContainer = undefined;
    this.loadingBg = undefined;
    this.loadingIndicator = undefined;
    this.loadingIndicatorNodes = [];
    this.loadingLabel = undefined;

    const stripHeight = 24;
    const stripWidth = Math.min(260, Math.max(170, Math.floor(containerW * 0.32)));
    const y = containerTop + stripHeight / 2 + 2;
    const container = this.scene.add.container(centerX, y).setDepth(this.depth + 3);
    const bg = this.scene
      .add.rectangle(0, 0, stripWidth, stripHeight, this.drawHelpers.toColor(HEADER_THEME.loadingBg), 0.92)
      .setStrokeStyle(1, this.drawHelpers.toColor(HEADER_THEME.loadingStroke), 0.82);
    const indicator = this.createLoadingIndicator(stripWidth);
    const label = this.scene
      .add.text(8, -1, this.interactionLoadingLabel, {
        fontSize: "12px",
        fontFamily: "Arial",
        fontStyle: "bold",
        color: "#f5f8ff",
        stroke: HEADER_THEME.textStroke,
        strokeThickness: 2,
        align: "center",
      })
      .setOrigin(0.5);
    container.add([bg, indicator, label]);
    container.setVisible(this.interactionLoadingVisible);
    this.loadingContainer = container;
    this.loadingBg = bg;
    this.loadingIndicator = indicator;
    this.loadingLabel = label;
    this.syncLoadingLabel();
    if (this.interactionLoadingVisible) {
      this.startLoadingAnimation();
    }
  }

  private startLoadingAnimation() {
    if (!this.loadingContainer || !this.loadingBg || !this.loadingIndicator || !this.loadingLabel) return;
    if (this.loadingPulseTween) return;

    this.loadingPulseTween = this.scene.tweens.add({
      targets: this.loadingBg,
      alpha: 0.7,
      duration: 560,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    this.loadingIndicatorTweens = this.createIndicatorTweens();

    this.loadingLabelTween = this.scene.tweens.add({
      targets: this.loadingLabel,
      alpha: 0.75,
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    this.loadingDotsTimer = this.scene.time.addEvent({
      delay: 320,
      loop: true,
      callback: () => {
        this.loadingDotsFrame = (this.loadingDotsFrame + 1) % 4;
        this.syncLoadingLabel();
      },
    });
  }

  private stopLoadingAnimation() {
    this.loadingPulseTween?.remove();
    this.loadingPulseTween = undefined;
    this.loadingIndicatorTweens.forEach((tween) => tween.remove());
    this.loadingIndicatorTweens = [];
    this.loadingLabelTween?.remove();
    this.loadingLabelTween = undefined;
    this.loadingDotsTimer?.remove(false);
    this.loadingDotsTimer = undefined;
    this.loadingDotsFrame = 0;
    if (this.loadingBg) {
      this.loadingBg.setAlpha(0.92);
    }
    if (this.loadingLabel) {
      this.loadingLabel.setAlpha(1);
    }
    this.resetLoadingIndicatorVisuals();
    this.syncLoadingLabel();
  }

  private syncLoadingLabel() {
    const suffix = ".".repeat(this.loadingDotsFrame);
    this.loadingLabel?.setText(`${this.interactionLoadingLabel}${suffix}`);
  }

  private normalizeLoadingLabel(label?: string): string {
    const fallback = "Processing";
    const text = (label || fallback).trim() || fallback;
    return text.replace(/\s*\.+$/, "");
  }

  private createLoadingIndicator(stripWidth: number): Phaser.GameObjects.Container {
    const indicator = this.scene.add.container(-stripWidth / 2 + 16, 0);
    this.loadingIndicatorNodes = [];

    if (this.loadingVariant === "minimalDots") {
      const offsets = [-4, 0, 4];
      offsets.forEach((x) => {
        const dot = this.scene.add.circle(x, 0, 1.9, 0xe8f0ff, 0.55);
        indicator.add(dot);
        this.loadingIndicatorNodes.push(dot);
      });
      return indicator;
    }

    if (this.loadingVariant === "softPulse") {
      const glow = this.scene.add.circle(0, 0, 5.2, 0xbdd0ff, 0.16);
      const core = this.scene.add.circle(0, 0, 2.2, 0xeaf2ff, 0.95);
      indicator.add([glow, core]);
      this.loadingIndicatorNodes.push(glow, core);
      return indicator;
    }

    // orbital (default): rotating accent dot around a ring.
    const ring = this.scene.add.circle(0, 0, 5, 0x000000, 0).setStrokeStyle(1, 0x9cb8ff, 0.7);
    const dot = this.scene.add.circle(0, -5, 1.8, 0xe8f0ff, 1);
    indicator.add([ring, dot]);
    this.loadingIndicatorNodes.push(ring, dot);
    return indicator;
  }

  private createIndicatorTweens(): Phaser.Tweens.Tween[] {
    const indicator = this.loadingIndicator;
    if (!indicator) return [];

    if (this.loadingVariant === "minimalDots") {
      const dots = this.loadingIndicatorNodes.filter((node): node is Phaser.GameObjects.Arc => node instanceof Phaser.GameObjects.Arc);
      return dots.map((dot, index) =>
        this.scene.tweens.add({
          targets: dot,
          alpha: 1,
          scale: 1.24,
          duration: 280,
          yoyo: true,
          repeat: -1,
          delay: index * 100,
          ease: "Sine.easeInOut",
        }),
      );
    }

    if (this.loadingVariant === "softPulse") {
      const [glow, core] = this.loadingIndicatorNodes;
      const tweens: Phaser.Tweens.Tween[] = [];
      if (glow) {
        tweens.push(
          this.scene.tweens.add({
            targets: glow,
            alpha: 0.36,
            scale: 1.35,
            duration: 520,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
          }),
        );
      }
      if (core) {
        tweens.push(
          this.scene.tweens.add({
            targets: core,
            alpha: 0.78,
            duration: 460,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
          }),
        );
      }
      return tweens;
    }

    // orbital
    return [
      this.scene.tweens.add({
        targets: indicator,
        angle: 360,
        duration: 860,
        repeat: -1,
        ease: "Linear",
      }),
    ];
  }

  private resetLoadingIndicatorVisuals() {
    if (this.loadingIndicator) {
      this.loadingIndicator.setAngle(0);
    }
    this.loadingIndicatorNodes.forEach((node) => {
      if (typeof (node as any).setAlpha === "function") (node as any).setAlpha(1);
      if (typeof (node as any).setScale === "function") (node as any).setScale(1);
    });
    if (this.loadingVariant === "minimalDots") {
      const dots = this.loadingIndicatorNodes.filter((node): node is Phaser.GameObjects.Arc => node instanceof Phaser.GameObjects.Arc);
      dots.forEach((dot) => dot.setAlpha(0.55));
    }
    if (this.loadingVariant === "softPulse") {
      const [glow] = this.loadingIndicatorNodes;
      if (glow && typeof (glow as any).setAlpha === "function") {
        (glow as any).setAlpha(0.16);
      }
    }
  }

  private drawMenuIcon(x: number, y: number, size: number) {
    const lineLength = Math.round(size * 0.46);
    const gap = Math.round(size * 0.16);
    const half = Math.floor(lineLength / 2);
    const lineX1 = x - half;
    const lineX2 = x + half;

    this.menuIcon?.destroy();
    this.menuIcon = this.scene.add.graphics().setDepth(this.depth + 4);
    this.menuIcon.lineStyle(3, this.drawHelpers.toColor(HEADER_THEME.menuIcon), 1);
    this.menuIcon.lineBetween(lineX1, y - gap, lineX2, y - gap);
    this.menuIcon.lineBetween(lineX1, y, lineX2, y);
    this.menuIcon.lineBetween(lineX1, y + gap, lineX2, y + gap);
  }

  private drawMenuHit(x: number, y: number, w: number, h: number) {
    this.menuHit?.destroy();
    this.menuHit = this.scene.add.rectangle(x, y, w, h, 0x000000, 0).setDepth(this.depth + 2);
    if (this.onMenu) {
      this.menuHit.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.onMenu?.());
    }
  }

  private syncLabelsFromState() {
    if (this.handLabel) {
      const handLabel = this.state.opponentHand !== undefined ? this.state.opponentHand : this.state.handCount;
      const handDisplay = handLabel === null || handLabel === undefined || handLabel === "" ? "-" : `${handLabel}`;
      this.handLabel.setText(`Opponent Hand: ${handDisplay}`);
    }
  }
}
