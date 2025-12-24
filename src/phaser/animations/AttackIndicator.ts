import Phaser from "phaser";

type Point = { x: number; y: number };
export type AttackIndicatorStyle = "player" | "opponent";

type ShowOpts = {
  from: Point;
  to: Point;
  style?: AttackIndicatorStyle;
};

export class AttackIndicator {
  private container?: Phaser.GameObjects.Container;
  private glowGraphics?: Phaser.GameObjects.Graphics;
  private coreGraphics?: Phaser.GameObjects.Graphics;
  private highlightGraphics?: Phaser.GameObjects.Graphics;
  private drawTween?: Phaser.Tweens.Tween;
  private pulseTween?: Phaser.Tweens.Tween;
  private fadeTween?: Phaser.Tweens.Tween;
  private glowTween?: Phaser.Tweens.Tween;
  private state = { progress: 0, pulse: 0, glowShift: 0 };
  private current?: ShowOpts;
  private currentStyle: AttackIndicatorStyle = "player";

  constructor(private scene: Phaser.Scene) {}

  show(opts: ShowOpts) {
    this.reset();
    this.current = opts;
    this.currentStyle = opts.style ?? "player";
    console.log("[AttackIndicator] show", opts);
    this.container = this.scene.add.container(0, 0);
    this.glowGraphics = this.scene.add.graphics();
    this.coreGraphics = this.scene.add.graphics();
    this.highlightGraphics = this.scene.add.graphics();
    this.glowGraphics?.setBlendMode(Phaser.BlendModes.ADD);
    this.highlightGraphics?.setBlendMode(Phaser.BlendModes.ADD);
    this.container.add([this.glowGraphics!, this.coreGraphics!, this.highlightGraphics!]);
    this.container.setDepth(500);
    this.container.setAlpha(0);
    this.state.progress = 0;
    this.state.pulse = 0;
    this.state.glowShift = 0;
    this.fadeTween = this.scene.tweens.add({
      targets: this.container,
      alpha: { from: 0, to: 1 },
      duration: 150,
      ease: "Sine.easeOut",
    });
    this.drawTween = this.scene.tweens.add({
      targets: this.state,
      progress: 1,
      duration: 300,
      ease: "Sine.easeOut",
      onUpdate: () => this.renderArrow(),
      onComplete: () => this.startPulse(),
    });
    this.glowTween = this.scene.tweens.add({
      targets: this.state,
      glowShift: 1,
      duration: 900,
      repeat: -1,
      ease: "Linear",
      onUpdate: () => this.renderArrow(),
    });
  }

  hide(opts: { immediate?: boolean; fadeDuration?: number } = {}) {
    if (!this.container) return;
    console.log("[AttackIndicator] hide", { immediate: opts.immediate, fadeDuration: opts.fadeDuration });
    const fadeDuration = opts.fadeDuration ?? 220;
    if (opts.immediate) {
      this.destroyGraphics();
      return;
    }
    const target = this.container;
    this.fadeTween?.remove();
    this.fadeTween = this.scene.tweens.add({
      targets: target,
      alpha: 0,
      duration: fadeDuration,
      ease: "Sine.easeIn",
      onComplete: () => this.destroyGraphics(),
    });
  }

  private startPulse() {
    this.pulseTween?.remove();
    this.pulseTween = this.scene.tweens.add({
      targets: this.state,
      pulse: 1,
      duration: 650,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
      onUpdate: () => this.renderArrow(),
    });
  }

  private renderArrow() {
    if (!this.current || !this.glowGraphics || !this.coreGraphics || !this.highlightGraphics) return;
    if (!this.container) return;
    const { from, to } = this.current;
    const progress = Phaser.Math.Clamp(this.state.progress, 0, 1);
    const pulse = Phaser.Math.Clamp(this.state.pulse, 0, 1);
    const drawT = Phaser.Math.Clamp(progress, 0.01, 1);
    const pathPoints = this.sampleLinePoints({ from, to, t: drawT, segments: 48 });
    if (pathPoints.length < 2) return;
    const finalPoint = pathPoints[pathPoints.length - 1];
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const angle = Math.atan2(dy, dx);
    const endX = finalPoint.x;
    const endY = finalPoint.y;
    const arrowHeadProgress = Phaser.Math.Clamp((drawT - 0.5) / 0.5, 0, 1);
    const headLength = 38 * arrowHeadProgress;
    const headWidth = 26 * arrowHeadProgress;
    const pulseThickness = 8 + pulse * 2;
    const glowAlpha = 0.3 + pulse * 0.2;
    const lineAlpha = 0.85 + pulse * 0.15;
    const trimDistance = headLength > 0 ? headLength * 0.45 : 0;
    const renderPath = trimDistance > 0 ? this.trimPathEnd(pathPoints, trimDistance) : pathPoints;

    this.glowGraphics.clear();
    this.coreGraphics.clear();
    this.highlightGraphics.clear();

    // Outer glow trail
    const palette = this.getPalette(this.currentStyle);
    this.glowGraphics.lineStyle(pulseThickness + 8, palette.glowOuter, glowAlpha);
    this.drawSolidPath(this.glowGraphics, renderPath);

    // Secondary glow for soft inner aura
    this.glowGraphics.lineStyle(pulseThickness + 2, palette.glowInner, glowAlpha * 0.5);
    this.drawSolidPath(this.glowGraphics, renderPath);

    // Core line
    this.coreGraphics.lineStyle(pulseThickness, palette.core, lineAlpha);
    this.drawSolidPath(this.coreGraphics, renderPath);

    // Traveling highlight pulse
    const minHighlight = 0.1;
    if (drawT > minHighlight) {
      const highlightSpan = 0.08;
      const travel = Phaser.Math.Linear(minHighlight, drawT, this.state.glowShift);
      const startT = Phaser.Math.Clamp(travel - highlightSpan, 0, drawT);
      const endT = Phaser.Math.Clamp(travel + highlightSpan, 0, drawT);
      if (endT > startT) {
        const startX = from.x + dx * startT;
        const startY = from.y + dy * startT;
        const highlightX = from.x + dx * endT;
        const highlightY = from.y + dy * endT;
        this.highlightGraphics.lineStyle(4 + pulse * 2, palette.highlight, 0.9);
        this.highlightGraphics.beginPath();
        this.highlightGraphics.moveTo(startX, startY);
        this.highlightGraphics.lineTo(highlightX, highlightY);
        this.highlightGraphics.strokePath();
      }
    }

    if (arrowHeadProgress > 0) {
      const baseX = endX - Math.cos(angle) * headLength;
      const baseY = endY - Math.sin(angle) * headLength;
      const innerX = endX - Math.cos(angle) * (headLength * 0.45);
      const innerY = endY - Math.sin(angle) * (headLength * 0.45);
      const tailX = endX - Math.cos(angle) * (headLength * 0.8);
      const tailY = endY - Math.sin(angle) * (headLength * 0.8);
      const perpAngle = angle + Math.PI / 2;
      const halfWidth = headWidth / 2;
      const innerHalf = halfWidth * 0.55;
      const tailHalf = halfWidth * 0.3;
      const points = [
        new Phaser.Geom.Point(endX, endY),
        new Phaser.Geom.Point(baseX + Math.cos(perpAngle) * halfWidth, baseY + Math.sin(perpAngle) * halfWidth),
        new Phaser.Geom.Point(innerX + Math.cos(perpAngle) * innerHalf, innerY + Math.sin(perpAngle) * innerHalf),
        new Phaser.Geom.Point(tailX + Math.cos(perpAngle) * tailHalf, tailY + Math.sin(perpAngle) * tailHalf),
        new Phaser.Geom.Point(tailX - Math.cos(perpAngle) * tailHalf, tailY - Math.sin(perpAngle) * tailHalf),
        new Phaser.Geom.Point(innerX - Math.cos(perpAngle) * innerHalf, innerY - Math.sin(perpAngle) * innerHalf),
        new Phaser.Geom.Point(baseX - Math.cos(perpAngle) * halfWidth, baseY - Math.sin(perpAngle) * halfWidth),
      ];
      const tipPulse = 0.75 + 0.25 * Math.sin(pulse * Math.PI * 2);
      this.glowGraphics.fillStyle(palette.arrowhead, glowAlpha + 0.35 * tipPulse);
      this.glowGraphics.fillPoints(points, true);
      this.coreGraphics.fillStyle(palette.core, lineAlpha);
      this.coreGraphics.fillPoints(points, true);
    }
  }

  private reset() {
    this.drawTween?.remove();
    this.pulseTween?.remove();
    this.fadeTween?.remove();
    this.glowTween?.remove();
    this.destroyGraphics();
    this.state.progress = 0;
    this.state.pulse = 0;
    this.state.glowShift = 0;
  }

  private destroyGraphics() {
    this.container?.destroy();
    this.glowGraphics = undefined;
    this.coreGraphics = undefined;
    this.highlightGraphics = undefined;
    this.container = undefined;
    this.current = undefined;
  }
  private sampleLinePoints({ from, to, t, segments }: { from: Point; to: Point; t: number; segments: number }) {
    const pts: Phaser.Math.Vector2[] = [];
    const clamped = Phaser.Math.Clamp(t, 0, 1);
    for (let i = 0; i <= segments; i++) {
      const ratio = (clamped * i) / segments;
      const px = Phaser.Math.Linear(from.x, to.x, ratio);
      const py = Phaser.Math.Linear(from.y, to.y, ratio);
      pts.push(new Phaser.Math.Vector2(px, py));
    }
    return pts;
  }

  private trimPathEnd(points: Phaser.Math.Vector2[], trimDistance: number) {
    if (!points.length || trimDistance <= 0) return points;
    const trimmed = points.map((p) => p.clone());
    let remaining = trimDistance;
    while (trimmed.length > 1 && remaining > 0) {
      const lastIndex = trimmed.length - 1;
      const last = trimmed[lastIndex];
      const prev = trimmed[lastIndex - 1];
      const segLen = Phaser.Math.Distance.Between(prev.x, prev.y, last.x, last.y);
      if (segLen <= remaining) {
        trimmed.pop();
        remaining -= segLen;
      } else {
        const keepRatio = (segLen - remaining) / segLen;
        const newX = prev.x + (last.x - prev.x) * keepRatio;
        const newY = prev.y + (last.y - prev.y) * keepRatio;
        trimmed[lastIndex] = new Phaser.Math.Vector2(newX, newY);
        remaining = 0;
      }
    }
    return trimmed;
  }

  private getPalette(style: AttackIndicatorStyle) {
    if (style === "opponent") {
      return {
        glowOuter: 0xfff17f,
        glowInner: 0xfff6b7,
        core: 0xffd86a,
        highlight: 0xffffff,
        arrowhead: 0xffe061,
      };
    }
    return {
      glowOuter: 0xff5470,
      glowInner: 0xfdee89,
      core: 0xfff06a,
      highlight: 0xffffff,
      arrowhead: 0xff3358,
    };
  }

  private drawSolidPath(graphics: Phaser.GameObjects.Graphics, points: Phaser.Math.Vector2[]) {
    if (!points.length) return;
    graphics.beginPath();
    graphics.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      graphics.lineTo(points[i].x, points[i].y);
    }
    graphics.strokePath();
  }
}
