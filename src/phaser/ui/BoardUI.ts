import Phaser from "phaser";
import { BASE_H, BASE_W } from "../../config/gameLayout";
import { FieldHandler } from "./FieldHandler";
import { HandAreaHandler } from "./HandAreaHandler";
import { ActionButtonBarHandler } from "./ActionButtonBarHandler";
import { HeaderHandler, DrawHelpers, FRAME_STYLE } from "./HeaderHandler";
import { Offset, Palette } from "./types";
import type { BaseControls } from "./BaseShieldHandler";
type EnergyControls = ReturnType<FieldHandler["getEnergyControls"]>;
type StatusControls = ReturnType<FieldHandler["getStatusControls"]>;
type HandControls = {
  setVisible: (visible: boolean) => void;
  fadeIn: (duration?: number) => void;
  setHand: (cards: Array<{ color: number; cost?: string; textureKey?: string }>) => void;
  clearHand: () => void;
};
type HeaderControls = {
  setStatus: (text: string) => void;
  setButtonVisible: (visible: boolean) => void;
  setButtonHandler: (handler: () => void) => void;
  setAvatarHandler: (handler: () => void) => void;
};

export class BoardUI {
  private framePadding = 12;
  private drawHelpers: DrawHelpers;
  private header: HeaderHandler;
  private field: FieldHandler;
  private hand: HandAreaHandler;
  private actions: ActionButtonBarHandler;
  private baseControls: BaseControls;
  private energyControls: EnergyControls;
  private statusControls: StatusControls;
  private handControls: HandControls;
  private headerControls: HeaderControls;

  constructor(private scene: Phaser.Scene, private palette: Palette) {
    this.drawHelpers = new DrawHelpers(scene);
    this.header = new HeaderHandler(scene, palette, this.drawHelpers, this.framePadding);
    this.field = new FieldHandler(scene, palette, this.drawHelpers);
    this.baseControls = this.field.getBaseControls();
    this.energyControls = this.field.getEnergyControls();
    this.statusControls = this.field.getStatusControls();
    this.hand = new HandAreaHandler(scene, palette, this.drawHelpers);
    this.handControls = {
      setVisible: (visible: boolean) => this.hand.setVisible(visible),
      fadeIn: (duration?: number) => this.hand.fadeIn(duration),
      setHand: (cards) => this.hand.setHand(cards),
      clearHand: () => this.hand.clearHand(),
    };
    this.actions = new ActionButtonBarHandler(scene, palette, this.drawHelpers);
    this.headerControls = {
      setStatus: (text: string) => this.header.setStatusText(text),
      setButtonVisible: (visible: boolean) => this.header.setCtaVisible(visible),
      setButtonHandler: (handler: () => void) => this.header.setCtaHandler(handler),
      setAvatarHandler: (handler: () => void) => this.header.setAvatarHandler(handler),
    };
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

  drawAll(offset: Offset) {
    this.drawFrame(offset);
    this.drawHeader(offset);
    this.drawField(offset);
    this.drawActions(offset);
    this.drawHand(offset);
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

  setHandVisible(visible: boolean) {
    this.hand.setVisible(visible);
  }

  fadeInHand(duration = 200) {
    this.hand.fadeIn(duration);
  }

  setActionHandler(handler: (index: number) => void) {
    this.actions.setActionHandler(handler);
  }

  setHeaderButtonHandler(handler: () => void) {
    this.header.setCtaHandler(handler);
  }

  setHeaderButtonVisible(visible: boolean) {
    this.header.setCtaVisible(visible);
  }

  setHeaderStatus(text: string) {
    this.header.setStatusText(text);
  }

  setAvatarHandler(handler: () => void) {
    this.header.setAvatarHandler(handler);
  }

  getBaseControls(): BaseControls {
    return this.baseControls;
  }

  setStatusVisible(visible: boolean) {
    this.field.setStatusVisible(visible);
  }

  fadeInStatus(duration = 200) {
    this.field.fadeInStatus(duration);
  }

  getEnergyControls() {
    return this.energyControls;
  }

  getStatusControls() {
    return this.statusControls;
  }

  getHandControls() {
    return this.handControls;
  }

  getActionControls() {
    return {
      setVisible: (visible: boolean) => this.actions.setVisible(visible),
      fadeIn: (duration?: number) => this.actions.fadeIn(duration),
    };
  }

  getHeaderControls() {
    return this.headerControls;
  }
}
