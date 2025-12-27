import Phaser from "phaser";
import { FieldHandler } from "./FieldHandler";
import { HandAreaHandler } from "./HandAreaHandler";
import { ActionButtonBarHandler } from "./ActionButtonBarHandler";
import { HeaderHandler, DrawHelpers, FRAME_STYLE } from "./HeaderHandler";
import { Offset, Palette } from "./types";
import { formatHeaderStatus } from "./HeaderStatusFormatter";
import type { ShieldAreaControls } from "./ShieldAreaHandler";
import type { HandCardView } from "./HandTypes";
type EnergyControls = ReturnType<FieldHandler["getEnergyControls"]>;
type StatusControls = ReturnType<FieldHandler["getStatusControls"]>;
type SlotControls = ReturnType<FieldHandler["getSlotControls"]>;
type HandControls = {
  setVisible: (visible: boolean) => void;
  fadeIn: () => void;
  setHand: (cards: HandCardView[], opts?: { preserveSelectionUid?: string }) => void;
  clearHand: () => void;
  clearSelection?: () => void;
  setCardClickHandler?: (handler: (card: HandCardView) => void) => void;
};
type HeaderControls = {
  setStatus: (text: string) => void;
  setStatusFromEngine?: (status: any, opts?: { offlineFallback?: boolean }) => void;
  setAvatarHandler: (handler: () => void) => void;
};

export class BoardUI {
  private drawHelpers: DrawHelpers;
  private header: HeaderHandler;
  private field: FieldHandler;
  private hand: HandAreaHandler;
  private actions: ActionButtonBarHandler;
  private baseControls: ShieldAreaControls;
  private energyControls: EnergyControls;
  private statusControls: StatusControls;
  private slotControls: SlotControls;
  private handControls: HandControls;
  private headerControls: HeaderControls;

  constructor(private scene: Phaser.Scene, private palette: Palette) {
    this.drawHelpers = new DrawHelpers(scene);
    this.header = new HeaderHandler(scene, palette, this.drawHelpers);
    this.field = new FieldHandler(scene, palette, this.drawHelpers);
    this.baseControls = this.field.getBaseControls();
    this.energyControls = this.field.getEnergyControls();
    this.statusControls = this.field.getStatusControls();
    this.slotControls = this.field.getSlotControls();
    this.hand = new HandAreaHandler(scene, palette, this.drawHelpers);
    this.handControls = {
      setVisible: (visible: boolean) => this.hand.setVisible(visible),
      fadeIn: () => this.hand.fadeIn(),
      setHand: (cards, opts) => this.hand.setHand(cards, opts),
      clearHand: () => this.hand.clearHand(),
      clearSelection: () => this.hand.clearSelection(),
      setCardClickHandler: (handler) => this.hand.setCardClickHandler?.(handler),
    };
    this.actions = new ActionButtonBarHandler(scene);
    this.headerControls = {
      setStatus: (text: string) => this.header.setStatusText(text),
      setStatusFromEngine: (status: any, opts?: { offlineFallback?: boolean }) => {
        const text = formatHeaderStatus(status, opts);
        if (text) {
          this.header.setStatusText(text);
        }
      },
      setAvatarHandler: (handler: () => void) => this.header.setAvatarHandler(handler),
    };
  }

  drawFrame() {
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
    this.drawFrame();
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

  updateHeader(state: {
    handCount?: number;
    orbCount?: number;
    scoreCurrent?: number;
    scoreMax?: number;
    name?: string;
    opponentHand?: number | string;
  }) {
    this.header.updateState(state);
  }

  setHand(cards: Array<{ color: number; cost?: string }>, opts?: { preserveSelectionUid?: string }) {
    this.hand.setHand(cards, opts);
  }

  setHandVisible(visible: boolean) {
    this.hand.setVisible(visible);
  }

  fadeInHand() {
    this.hand.fadeIn();
  }

  setActionHandler(handler: (index: number) => void) {
    this.actions.setActionHandler(handler);
  }

  setHeaderStatus(text: string) {
    this.header.setStatusText(text);
  }

  setAvatarHandler(handler: () => void) {
    this.header.setAvatarHandler(handler);
  }

  getBaseControls(): ShieldAreaControls {
    return this.baseControls;
  }

  setStatusVisible(visible: boolean) {
    this.field.setStatusVisible(visible);
  }

  fadeInStatus() {
    this.field.fadeInStatus();
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

  getSlotControls() {
    return this.slotControls;
  }

  getActionControls() {
    return {
      setVisible: (visible: boolean) => this.actions.setVisible(visible),
      fadeIn: (duration?: number) => this.actions.fadeIn(duration),
      setButtons: (labels: string[]) => this.actions.setButtons(labels),
      setActionHandler: (handler: (index: number) => void) => this.actions.setActionHandler(handler),
      setDescriptors: (buttons: { label: string; onClick?: () => void; enabled?: boolean; primary?: boolean }[]) =>
        this.actions.setDescriptors(buttons),
      setState: (state: { descriptors: any[] }) => this.actions.setState(state),
      setWaitingForOpponent: (waiting: boolean, overrideButtons?: { label: string; onClick?: () => void; enabled?: boolean; primary?: boolean }[]) =>
        this.actions.setWaitingForOpponent(waiting, overrideButtons),
    };
  }

  getHeaderControls() {
    return this.headerControls;
  }
}
