import Phaser from "phaser";
import { BASE_H, BASE_W } from "../config/gameLayout";
import { BoardUI } from "./ui/BoardUI";

const colors = {
  bg: "#153ae0ff",
  board: "#1a1d26",
  slot: "#2a2d38",
  accent: "#d0d5e0",
  pill: "#2f3342",
  text: "#f5f6fb",
  ink: "#0f1118",
};

export class BoardScene extends Phaser.Scene {
  constructor() {
    super("BoardScene");
  }

  private offset = { x: 0, y: 0 };
  private ui: BoardUI | null = null;

  create() {
    // Center everything based on the actual viewport, not just BASE_W/H.
    const cam = this.cameras.main;
    this.offset.x = cam.centerX - BASE_W / 2;
    this.offset.y = cam.centerY - BASE_H / 2;
    console.log("offset y ", cam.centerY)

    this.cameras.main.setBackgroundColor(colors.bg);
    this.drawFrame();
    this.ui = new BoardUI(this, {
      ink: colors.ink,
      slot: colors.slot,
      accent: colors.accent,
      text: colors.text,
    });
    this.ui.drawHeader(this.offset);
    this.ui.drawField(this.offset);
    this.ui.drawFieldCards(this.offset);
    this.ui.drawHand(this.offset);
  }

  // ----- Layout helpers -----
  private frameRect = { x: BASE_W / 2, y: BASE_H / 2, w: BASE_W - 12, h: BASE_H - 12 };

  // ----- Frame & header -----
  private drawFrame() {
    this.drawRoundedRect({
      x: this.frameRect.x + this.offset.x,
      y: this.frameRect.y + this.offset.y,
      width: this.frameRect.w,
      height: this.frameRect.h,
      radius: 18,
      fillColor: colors.bg,
      fillAlpha: 0.98,
      strokeColor: 0x000000,
      strokeAlpha: 0.4,
      strokeWidth: 2,
    });
  }

  // ----- Primitive -----
  private drawRoundedRect(config: {
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
  }) {
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
    const g = this.add.graphics({ x: x - width / 2, y: y - height / 2 });
    g.fillStyle(this.toColor(fillColor), fillAlpha);
    g.fillRoundedRect(0, 0, width, height, radius);
    if (strokeWidth > 0 && strokeColor !== undefined) {
      g.lineStyle(strokeWidth, this.toColor(strokeColor), strokeAlpha);
      g.strokeRoundedRect(0, 0, width, height, radius);
    }
    return g;
  }

  private toColor(value: number | string) {
    return typeof value === "number" ? value : Phaser.Display.Color.HexStringToColor(value).color;
  }
}
