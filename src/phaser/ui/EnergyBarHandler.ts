import Phaser from "phaser";
import { DrawHelpers } from "./HeaderHandler";
import type { FieldConfig } from "./FieldHandler";

export class EnergyBarHandler {
  private circles: Phaser.GameObjects.Shape[] = [];
  private visible = true;

  constructor(private scene: Phaser.Scene, private drawHelpers: DrawHelpers) {}

  drawBar(centerX: number, baseY: number, cfg: FieldConfig["energy"], barWidth: number, isOpponent: boolean) {
    this.clear();
    const totalWidth = cfg.perRow * cfg.radius * 2 + (cfg.perRow - 1) * cfg.gap;
    const startX = isOpponent ? centerX + barWidth / 2 - totalWidth : centerX - barWidth / 2;
    let drawn = 0;
    for (let row = 0; row < cfg.rows; row++) {
      const y = baseY + row * (cfg.radius * 2 + cfg.rowGap);
      for (let i = 0; i < cfg.perRow && drawn < cfg.count; i++) {
        const index = isOpponent ? cfg.perRow - 1 - i : i;
        const x = startX + index * (cfg.radius * 2 + cfg.gap);
        const filled = drawn < cfg.count / 2;
        const circle = this.scene.add.circle(x, y, cfg.radius);
        circle.setStrokeStyle(2, this.drawHelpers.toColor(cfg.emptyColor), 1);
        if (filled) {
          circle.setFillStyle(this.drawHelpers.toColor(cfg.fillColor), 1);
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

  private clear() {
    this.circles.forEach((c) => c.destroy());
    this.circles = [];
  }
}
