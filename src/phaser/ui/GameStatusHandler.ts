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
  private visible = true;

  constructor(private scene: Phaser.Scene, private palette: Palette) {}

  draw(centerX: number, baseY: number, barWidth: number, isOpponent: boolean, status?: Partial<GameStatus>) {
    if (status) this.status = { ...this.status, ...status };
    const labelY = baseY + (isOpponent ? -20 : 20);
    const textStyle = {
      fontSize: "16px",
      fontFamily: "Arial",
      color: "#e74c3c",
      fontStyle: "bold",
    } as Phaser.Types.GameObjects.Text.TextStyle;

    // Precompute positions so each label can be tuned independently later.
    const positions = this.computeLabelPositions(centerX, barWidth);

    this.upsertLabel("shield", `Shield:${this.status.shield}`, positions.shield, labelY, textStyle);
    this.upsertLabel("active", `Active(E):${this.status.active}`, positions.active, labelY, textStyle);
    this.upsertLabel("rested", `Rested(E):${this.status.rested}`, positions.rested, labelY, textStyle);
    this.upsertLabel("extra", `Extra(E):${this.status.extra}`, positions.extra, labelY, textStyle);

    this.setVisible(this.visible);
  }

  private computeLabelPositions(centerX: number, barWidth: number) {
    // Evenly spaced for now; adjust individually here if needed.
    const startX = centerX - barWidth / 2;
    const step = barWidth / 3;
    return {
      shield: startX-30,
      active: startX +70,
      rested: startX + 180,
      extra: startX + 280
    };
  }

  private upsertLabel(key: keyof GameStatus, text: string, x: number, y: number, style: Phaser.Types.GameObjects.Text.TextStyle) {
    const existing = this.labels[key];
    if (existing) {
      existing.setText(text).setPosition(x, y);
    } else {
      this.labels[key] = this.scene.add.text(x, y, text, style).setOrigin(0.5);
    }
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

  setVisible(visible: boolean) {
    this.visible = visible;
    (Object.values(this.labels) as Phaser.GameObjects.Text[]).forEach((label) => label?.setVisible(visible));
  }

  fadeIn(duration = 200) {
    this.visible = true;
    (Object.values(this.labels) as Phaser.GameObjects.Text[]).forEach((label) => {
      if (!label) return;
      label.setVisible(true).setAlpha(0);
      this.scene.tweens.add({
        targets: label,
        alpha: 1,
        duration,
        ease: "Quad.easeOut",
      });
    });
  }
}
