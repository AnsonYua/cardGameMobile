import Phaser from "phaser";
import { DrawHelpers } from "./HeaderHandler";
import type { FieldConfig } from "./FieldHandler";

type EnergyToken = keyof EnergyCounts;

export type EnergyCounts = {
  active: number;
  rested: number;
  extra: number;
};

type TokenPalette = {
  active: { color: string; alpha: number };
  extra: { color: string; alpha: number };
  rested: { color: string; alpha: number };
};

const TOKEN_ORDER: EnergyToken[] = ["active", "extra", "rested"];
const DEFAULT_PALETTE: TokenPalette = {
  active: { color: "#18c56c", alpha: 1 },
  extra: { color: "#18c56c", alpha: 0.6 },
  rested: { color: "#d94d4d", alpha: 0.35 },
};

// Pure helpers keep rendering logic small and testable.
function buildTokenSequence(counts: EnergyCounts): EnergyToken[] {
  const sequence: EnergyToken[] = [];
  TOKEN_ORDER.forEach((key) => {
    const total = Math.max(0, counts[key]);
    for (let i = 0; i < total; i++) {
      sequence.push(key);
    }
  });
  return sequence;
}

function applyTokenStyle(circle: Phaser.GameObjects.Arc, token: EnergyToken, palette: TokenPalette, helpers: DrawHelpers) {
  const { color, alpha } = palette[token];
  circle.setFillStyle(helpers.toColor(color), alpha);
}

// Renders the energy token row/rows and remembers the last draw so counts can be refreshed without re-laying out.
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
    palette: TokenPalette;
  };
  private palette: TokenPalette = DEFAULT_PALETTE;

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
    const palette = this.palette;
    this.lastArgs = { centerX, baseY, cfg, barWidth, isOpponent, counts: { ...counts }, palette };
    const tokens = buildTokenSequence(counts);
    const total = tokens.length;
    const totalWidth = cfg.perRow * cfg.radius * 2 + (cfg.perRow - 1) * cfg.gap;
    const startX = isOpponent ? centerX + barWidth / 2 - totalWidth : centerX - barWidth / 2;
    let drawn = 0;
    for (let row = 0; row < cfg.rows; row++) {
      const y = baseY + row * (cfg.radius * 2 + cfg.rowGap);
      for (let i = 0; i < cfg.perRow && drawn < total; i++) {
        const index = isOpponent ? cfg.perRow - 1 - i : i;
        const x = startX + index * (cfg.radius * 2 + cfg.gap);
        const token = tokens[drawn];
        const circle = this.scene.add.circle(x, y, cfg.radius);
        circle.setStrokeStyle(2, this.drawHelpers.toColor(cfg.emptyColor), 1);
        applyTokenStyle(circle, token, palette, this.drawHelpers);
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

  // Re-render using the last known geometry while swapping the counts (keeps layout stable between updates).
  redrawWithCounts(counts: EnergyCounts) {
    if (!this.lastArgs) return;
    this.drawBar(this.lastArgs.centerX, this.lastArgs.baseY, this.lastArgs.cfg, this.lastArgs.barWidth, this.lastArgs.isOpponent, counts);
  }

  private clear() {
    this.circles.forEach((c) => c.destroy());
    this.circles = [];
  }
}
