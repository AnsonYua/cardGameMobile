import Phaser from "phaser";

export type CardPreviewConfig = {
  overlayAlpha: number;
  fadeIn: number;
  fadeOut: number;
};

export class CardPreviewOverlay {
  private container?: Phaser.GameObjects.Container;

  constructor(private scene: Phaser.Scene, private config: CardPreviewConfig) {}

  isActive() {
    return !!this.container;
  }

  show(draw: (container: Phaser.GameObjects.Container) => void, opts?: { depth?: number }) {
    this.hide(true);
    const cam = this.scene.cameras.main;
    const container = this.scene.add.container(cam.centerX, cam.centerY).setDepth(opts?.depth ?? 2000).setAlpha(0);

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x000000, this.config.overlayAlpha);
    bg.fillRect(-cam.width / 2, -cam.height / 2, cam.width, cam.height);
    bg.setInteractive(
      new Phaser.Geom.Rectangle(-cam.width / 2, -cam.height / 2, cam.width, cam.height),
      Phaser.Geom.Rectangle.Contains,
    );
    bg.on("pointerdown", () => this.hide());
    container.add(bg);

    draw(container);

    this.container = container;
    this.scene.tweens.add({
      targets: container,
      alpha: 1,
      duration: this.config.fadeIn,
      ease: "Quad.easeOut",
    });
  }

  hide(skipTween = false) {
    if (!this.container) return;
    const target = this.container;
    this.container = undefined;
    if (skipTween) {
      target.destroy();
      return;
    }
    this.scene.tweens.add({
      targets: target,
      alpha: 0,
      duration: this.config.fadeOut,
      ease: "Quad.easeIn",
      onComplete: () => target.destroy(),
    });
  }

  destroy() {
    this.hide(true);
  }
}
