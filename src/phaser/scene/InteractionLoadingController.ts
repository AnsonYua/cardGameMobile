import type Phaser from "phaser";

type HeaderLoadingSetter = (visible: boolean, label?: string) => void;

/**
 * Central interaction-loading state manager for click-driven API flows.
 * Uses a reference counter to avoid flicker when nested async chains overlap.
 */
export class InteractionLoadingController {
  private count = 0;
  private label = "Processing...";
  private blocker?: Phaser.GameObjects.Rectangle;

  constructor(
    private scene: Phaser.Scene,
    private setHeaderLoading: HeaderLoadingSetter,
  ) {}

  begin(label?: string) {
    if (label && label.trim()) {
      this.label = label.trim();
    }
    this.count += 1;
    this.syncUi();
  }

  end() {
    this.count = Math.max(0, this.count - 1);
    this.syncUi();
  }

  showLoading() {
    this.begin("Loading...");
  }

  hideLoading() {
    this.end();
  }

  destroy() {
    this.blocker?.destroy();
    this.blocker = undefined;
    this.count = 0;
  }

  private syncUi() {
    const visible = this.count > 0;
    this.setHeaderLoading(visible, this.label);
    const blocker = this.ensureBlocker();
    if (!blocker) return;
    const cam = this.scene.cameras.main;
    blocker.setPosition(cam.centerX, cam.centerY);
    blocker.setSize(cam.width, cam.height);

    if (visible) {
      blocker.setVisible(true);
      blocker.setInteractive({ useHandCursor: false });
      return;
    }
    blocker.disableInteractive();
    blocker.setVisible(false);
  }

  private ensureBlocker() {
    if (this.blocker) return this.blocker;
    const cam = this.scene.cameras.main;
    this.blocker = this.scene.add
      .rectangle(cam.centerX, cam.centerY, cam.width, cam.height, 0x000000, 0.001)
      .setDepth(18000)
      .setScrollFactor(0)
      .setVisible(false);
    return this.blocker;
  }
}
