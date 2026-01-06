import Phaser from "phaser";

export type Offset = { x: number; y: number };
export type Palette = { ink: string; slot: string; accent: string; text: string; bg: string };

export type RoundedRectConfig = {
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
};

export const toColor = (value: number | string) => {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Phaser.Display.Color.HexStringToColor(value).color;
  if (value && typeof value === "object" && "color" in value && typeof (value as any).color === "number") {
    return (value as any).color;
  }
  return 0xffffff;
};
