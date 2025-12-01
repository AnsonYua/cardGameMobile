import Phaser from "phaser";
import { BASE_H, BASE_W } from "../../config/gameLayout";
import { FieldHandler } from "./FieldHandler";
import { HandAreaHandler } from "./HandAreaHandler";
import { HeaderHandler } from "./HeaderHandler";
import { DrawHelpers } from "./HeaderHandler";
import { Offset, Palette } from "./types";

export class BoardUI {
  private framePadding = 12;
  private drawHelpers: DrawHelpers;
  private header: HeaderHandler;
  private field: FieldHandler;
  private hand: HandAreaHandler;

  constructor(private scene: Phaser.Scene, private palette: Palette) {
    this.drawHelpers = new DrawHelpers(scene);
    this.header = new HeaderHandler(scene, palette, this.drawHelpers, this.framePadding);
    this.field = new FieldHandler(scene, palette, this.drawHelpers);
    this.hand = new HandAreaHandler(scene, palette, this.drawHelpers);
  }

  drawFrame(offset: Offset) {
    const width = BASE_W - this.framePadding * 2;
    const height = BASE_H - this.framePadding * 2;
    this.drawHelpers.drawRoundedRect({
      x: BASE_W / 2 + offset.x,
      y: BASE_H / 2 + offset.y,
      width,
      height,
      radius: 18,
      fillColor: this.palette.bg,
      fillAlpha: 0.98,
      strokeColor: 0x000000,
      strokeAlpha: 0.4,
      strokeWidth: 2,
    });
  }

  drawHeader(offset: Offset) {
    this.header.draw(offset);
  }

  drawField(offset: Offset) {
    this.field.draw(offset);
  }

  drawHand(offset: Offset) {
    this.hand.draw(offset);
  }

  updateHeader(state: { handCount?: number; orbCount?: number; scoreCurrent?: number; scoreMax?: number; name?: string }) {
    this.header.updateState(state);
  }

  setHand(cards: Array<{ color: number; cost?: string }>) {
    this.hand.setHand(cards);
  }
}
