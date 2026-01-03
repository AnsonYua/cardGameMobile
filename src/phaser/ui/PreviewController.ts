import Phaser from "phaser";
import { CardPreviewOverlay } from "./CardPreviewOverlay";

type PreviewControllerConfig = {
  holdDelay: number;
  overlayAlpha: number;
  fadeIn: number;
  fadeOut: number;
  depth?: number;
};

export class PreviewController {
  private overlay: CardPreviewOverlay;
  private timer?: any;
  private active = false;
  private depth: number;
  private holdDelay: number;

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
  }

  isActive() {
    return this.active;
  }

  start(draw: (container: Phaser.GameObjects.Container) => void) {
    this.hide();
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.show(draw);
    }, this.holdDelay);
  }

  cancelPending() {
    if (!this.timer) return;
    clearTimeout(this.timer);
    this.timer = undefined;
  }

  hide(skipTween = false) {
    this.cancelPending();
    this.overlay.hide(skipTween);
    this.active = false;
  }

  destroy() {
    this.hide(true);
  }

  private show(draw: (container: Phaser.GameObjects.Container) => void) {
    this.overlay.show(draw, { depth: this.depth });
    this.active = true;
  }
}
