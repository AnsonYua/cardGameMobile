import type Phaser from "phaser";

export type RoundedGraphicsParams = {
  target: Phaser.GameObjects.Graphics;
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
  fillColor: number;
  fillAlpha: number;
  strokeColor?: number;
  strokeAlpha?: number;
  strokeWidth?: number;
};

export function redrawRoundedGraphics(params: RoundedGraphicsParams) {
  const {
    target,
    x,
    y,
    width,
    height,
    radius,
    fillColor,
    fillAlpha,
    strokeColor,
    strokeAlpha = 1,
    strokeWidth = 1,
  } = params;

  target.clear();
  target.fillStyle(fillColor, fillAlpha);
  target.fillRoundedRect(x - width / 2, y - height / 2, width, height, radius);
  if (strokeColor !== undefined && strokeWidth > 0) {
    target.lineStyle(strokeWidth, strokeColor, strokeAlpha);
    target.strokeRoundedRect(x - width / 2, y - height / 2, width, height, radius);
  }
}
