import Phaser from "phaser";
import { DrawHelpers } from "./HeaderHandler";
import type { FieldConfig } from "./FieldHandler";

export type EnergyCounts = {
  active: number;
  rested: number;
  extra: number;
};

export class EnergyBarHandler {
  private circles: Phaser.GameObjects.Shape[] = [];
  private visible = true;
  private lastArgs?: {
    centerX: number;
    baseY: number;
    cfg: FieldConfig["energy"];
    barWidth: number;
    isOpponent: boolean;
    counts: EnergyCounts;
  };

  constructor(private scene: Phaser.Scene, private drawHelpers: DrawHelpers) {}

  drawBar(
    centerX: number,
    baseY: number,
    cfg: FieldConfig["energy"],
    barWidth: number,
    isOpponent: boolean,
    counts: EnergyCounts = { active: 0, rested: 0, extra: 0 },
  ) {
    this.clear();
    this.lastArgs = { centerX, baseY, cfg: { ...cfg }, barWidth, isOpponent, counts: { ...counts } };
    const total = Math.max(0, counts.active) + Math.max(0, counts.rested) + Math.max(0, counts.extra);
    const totalWidth = cfg.perRow * cfg.radius * 2 + (cfg.perRow - 1) * cfg.gap;
    const startX = isOpponent ? centerX + barWidth / 2 - totalWidth : centerX - barWidth / 2;
    const tokens: Array<keyof EnergyCounts> = [];
    for (let i = 0; i < counts.active; i++) tokens.push("active");
    for (let i = 0; i < counts.extra; i++) tokens.push("extra");
    for (let i = 0; i < counts.rested; i++) tokens.push("rested");
    let drawn = 0;
    for (let row = 0; row < cfg.rows; row++) {
      const y = baseY + row * (cfg.radius * 2 + cfg.rowGap);
      for (let i = 0; i < cfg.perRow && drawn < total; i++) {
        const index = isOpponent ? cfg.perRow - 1 - i : i;
        const x = startX + index * (cfg.radius * 2 + cfg.gap);
        const token = tokens[drawn];
        const circle = this.scene.add.circle(x, y, cfg.radius);
        circle.setStrokeStyle(2, this.drawHelpers.toColor(cfg.emptyColor), 1);
        if (token === "active") {
          circle.setFillStyle(this.drawHelpers.toColor(cfg.fillColor), 1);
        } else if (token === "extra") {
          circle.setFillStyle(this.drawHelpers.toColor(cfg.fillColor), 0.6);
        } else if (token === "rested") {
          circle.setFillStyle(this.drawHelpers.toColor(cfg.emptyColor), 0.35);
        }
        circle.setVisible(this.visible);
        this.circles.push(circle);
        drawn++;
      }
    }
  }

  setVisible(visible: boolean) {
    this.visible = visible;
    // Defensive: filter out any shapes that were destroyed to avoid property access errors.
    this.circles = this.circles.filter((c) => c && !(c as any).destroyed);
    this.circles.forEach((c) => c.setVisible(visible));
  }

  fadeIn(duration = 200) {
    this.visible = true;
    this.circles = this.circles.filter((c) => c && !(c as any).destroyed);
    this.circles.forEach((c) => {
      if (!c) return;
      c.setVisible(true).setAlpha(0);
      this.scene.tweens.add({
        targets: c as any,
        alpha: 1,
        duration,
        ease: "Quad.easeOut",
      });
    });
  }

  redrawWithCounts(counts: EnergyCounts) {
    if (!this.lastArgs) return;
    this.drawBar(
      this.lastArgs.centerX,
      this.lastArgs.baseY,
      this.lastArgs.cfg,
      this.lastArgs.barWidth,
      this.lastArgs.isOpponent,
      counts,
    );
  }

  private clear() {
    this.circles.forEach((c) => c.destroy());
    this.circles = [];
  }
}
