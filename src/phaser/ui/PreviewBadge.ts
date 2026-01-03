import Phaser from "phaser";
import { DrawHelpers } from "./HeaderHandler";

export type PreviewBadgeOptions = {
  container: Phaser.GameObjects.Container;
  drawHelpers?: DrawHelpers;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  baseDepth: number;
  fillColor?: number;
  fillAlpha?: number;
  radius?: number;
  widthPad?: number;
  depthPillOffset?: number;
  depthTextOffset?: number;
  textStyle: Phaser.Types.GameObjects.Text.TextStyle;
};

// Shared helper to draw a pill + text; callers control depths and sizes to preserve their layouts.
export function drawPreviewBadge(opts: PreviewBadgeOptions) {
  const {
    container,
    drawHelpers,
    x,
    y,
    width,
    height,
    label,
    baseDepth,
    fillColor = 0x000000,
    fillAlpha = 1,
    radius = 6,
    widthPad = 0,
    depthPillOffset = 1,
    depthTextOffset = 2,
    textStyle,
  } = opts;

  const pill = drawHelpers
    ? drawHelpers.drawRoundedRect({
        x,
        y,
        width: width + widthPad,
        height,
        radius,
        fillColor,
        fillAlpha,
        strokeAlpha: 0,
        strokeWidth: 0,
      })
    : container.scene.add.rectangle(x, y, width + widthPad, height, fillColor, fillAlpha).setOrigin(0.5);
  pill.setDepth(baseDepth + depthPillOffset);

  const text = container.scene.add
    .text(x, y, label, textStyle)
    .setOrigin(0.5)
    .setDepth(baseDepth + depthTextOffset);

  container.add(pill);
  container.add(text);
}
