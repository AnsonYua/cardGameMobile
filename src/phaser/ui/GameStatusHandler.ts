import Phaser from "phaser";
import { Palette } from "./types";

export type GameStatus = {
  shield: number;
  active: number;
  rested: number;
  extra: number;
};

export class GameStatusHandler {
  private labels: Partial<Record<keyof GameStatus, Phaser.GameObjects.Text>> = {};
  private status: GameStatus = { shield: 0, active: 0, rested: 0, extra: 0 };

  constructor(private scene: Phaser.Scene, private palette: Palette) {}

  draw(centerX: number, baseY: number, barWidth: number, isTop: boolean, status?: Partial<GameStatus>) {
    if (status) this.status = { ...this.status, ...status };
    const labelY = baseY + (isTop ? -20 : 20);
    const textStyle = {
      fontSize: "16px",
      fontFamily: "Arial",
      color: "#e74c3c",
      fontStyle: "bold",
    } as Phaser.Types.GameObjects.Text.TextStyle;

    const entries: Array<[keyof GameStatus, string]> = [
      ["shield", `Shield:${this.status.shield}`],
      ["active", `Active:${this.status.active}`],
      ["rested", `Rested:${this.status.rested}`],
      ["extra", `Extra:${this.status.extra}`],
    ];

    const step = barWidth / (entries.length - 1);
    const startX = centerX - barWidth / 2;

    entries.forEach(([key, text], i) => {
      const x = startX + i * step;
      const existing = this.labels[key];
      if (existing) {
        existing.setText(text).setPosition(x, labelY);
      } else {
        this.labels[key] = this.scene.add.text(x, labelY, text, textStyle).setOrigin(0.5);
      }
    });
  }

  update(status: Partial<GameStatus>) {
    this.status = { ...this.status, ...status };
    // Refresh existing labels with new values if they've been drawn.
    (Object.keys(this.labels) as Array<keyof GameStatus>).forEach((key) => {
      const label = this.labels[key];
      if (label) {
        const value = this.status[key];
        const prefix = key === "active" ? "Active" : key === "rested" ? "Rested" : key === "extra" ? "Extra" : "Shield";
        label.setText(`${prefix}:${value}`);
      }
    });
  }
}
