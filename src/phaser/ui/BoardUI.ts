import Phaser from "phaser";
import { BASE_H, BASE_W } from "../../config/gameLayout";
import { FieldHandler } from "./FieldHandler";
import { HandAreaHandler } from "./HandAreaHandler";
import { ActionButtonBarHandler } from "./ActionButtonBarHandler";
import { HeaderHandler, DrawHelpers, FRAME_STYLE } from "./HeaderHandler";
import { Offset, Palette } from "./types";
import type { BaseControls, BaseStatus } from "./BaseShieldHandler";

export class BoardUI {
  private framePadding = 12;
  private drawHelpers: DrawHelpers;
  private header: HeaderHandler;
  private field: FieldHandler;
  private hand: HandAreaHandler;
  private actions: ActionButtonBarHandler;
  private baseControls: BaseControls;

  constructor(private scene: Phaser.Scene, private palette: Palette) {
    this.drawHelpers = new DrawHelpers(scene);
    this.header = new HeaderHandler(scene, palette, this.drawHelpers, this.framePadding);
    this.field = new FieldHandler(scene, palette, this.drawHelpers);
    this.baseControls = this.field.getBaseControls();
    this.hand = new HandAreaHandler(scene, palette, this.drawHelpers);
    this.actions = new ActionButtonBarHandler(scene, palette, this.drawHelpers);
  }

  drawFrame(offset: Offset) {
    const camW = this.scene.scale.width;
    const camH = this.scene.scale.height;
    const width = camW;
    const height = camH;
    // Playmat background image stretched to full view.
    if (this.scene.textures.exists("playmat")) {
      this.scene.add
        .image(camW / 2, camH / 2, "playmat")
        .setDisplaySize(width, height)
        .setOrigin(0.5)
        .setDepth(-10);
    } else {
      this.drawHelpers.drawRoundedRect({
        x: camW / 2,
        y: camH / 2,
        width,
        height,
        fillColor: this.palette.bg,
        ...FRAME_STYLE,
      });
    }
  }

  drawHeader(offset: Offset) {
    this.header.draw(offset);
  }

  drawField(offset: Offset) {
    this.field.draw(offset);
  }

  drawActions(offset: Offset) {
    this.actions.draw(offset);
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

  setActionHandler(handler: (index: number) => void) {
    this.actions.setActionHandler(handler);
  }

  getBaseControls(): BaseControls {
    return this.baseControls;
  }
}
