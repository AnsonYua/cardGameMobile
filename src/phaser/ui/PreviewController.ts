import Phaser from "phaser";
import { CardPreviewOverlay } from "./CardPreviewOverlay";
import { isDebugFlagEnabled } from "../utils/debugFlags";

type PreviewControllerConfig = {
  holdDelay: number;
  overlayAlpha: number;
  fadeIn: number;
  fadeOut: number;
  depth?: number;
  debugName?: string;
};

export class PreviewController {
  private overlay: CardPreviewOverlay;
  private timer?: any;
  private active = false;
  private depth: number;
  private holdDelay: number;
  private debugPreview = isDebugFlagEnabled("debug.cardPreview");
  private debugName: string;

  constructor(scene: Phaser.Scene, config: PreviewControllerConfig) {
    this.overlay = new CardPreviewOverlay(scene, {
      overlayAlpha: config.overlayAlpha,
      fadeIn: config.fadeIn,
      fadeOut: config.fadeOut,
      onHide: () => {
        this.active = false;
      },
    });
    this.depth = config.depth ?? 5000;
    this.holdDelay = config.holdDelay;
    this.debugName = config.debugName ?? "preview";
  }

  isActive() {
    return this.active;
  }

  start(draw: (container: Phaser.GameObjects.Container) => void) {
    this.hide();
    if (this.debugPreview) {
      // eslint-disable-next-line no-console
      console.debug("[cardPreview] start", { target: this.debugName, holdDelay: this.holdDelay });
    }
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.show(draw);
    }, this.holdDelay);
  }

  cancelPending() {
    if (!this.timer) return;
    clearTimeout(this.timer);
    this.timer = undefined;
    if (this.debugPreview) {
      // eslint-disable-next-line no-console
      console.debug("[cardPreview] cancelPending", { target: this.debugName });
    }
  }

  hide(skipTween = false) {
    this.cancelPending();
    this.overlay.hide(skipTween);
    this.active = false;
    if (this.debugPreview) {
      // eslint-disable-next-line no-console
      console.debug("[cardPreview] hide", { target: this.debugName, skipTween, active: this.active });
    }
  }

  destroy() {
    this.hide(true);
  }

  private show(draw: (container: Phaser.GameObjects.Container) => void) {
    this.overlay.show(draw, { depth: this.depth });
    this.active = true;
    if (this.debugPreview) {
      // eslint-disable-next-line no-console
      console.debug("[cardPreview] show", { target: this.debugName, depth: this.depth });
    }
  }
}
