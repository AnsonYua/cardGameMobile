import Phaser from "phaser";

export class CoinFlipOverlay {
  private container?: Phaser.GameObjects.Container;
  private coin?: Phaser.GameObjects.Container;
  private active = false;

  constructor(private scene: Phaser.Scene) {}

  async play(): Promise<void> {
    if (this.active) return;
    this.active = true;
    this.destroy();

    const cam = this.scene.cameras.main;
    this.container = this.scene.add.container(cam.centerX, cam.centerY);
    this.container.setDepth(3200);

    const coin = this.scene.add.container(0, 0);
    const rim = this.scene.add.circle(0, 0, 52, 0x8b6a2f, 1);
    const face = this.scene.add.circle(0, 0, 46, 0xd8b65b, 1);
    const shine = this.scene.add.circle(-14, -14, 8, 0xfff2c2, 0.85);
    const label = this.scene.add.text(0, 0, "COIN", {
      fontSize: "16px",
      fontFamily: "Arial",
      fontStyle: "bold",
      color: "#1d1a10",
      align: "center",
    });
    label.setOrigin(0.5);
    coin.add([rim, face, shine, label]);
    this.container.add(coin);
    this.coin = coin;

    this.container.setAlpha(0).setScale(0.9);

    await new Promise<void>((resolve) => {
      this.scene.tweens.add({
        targets: this.container,
        alpha: 1,
        scale: 1,
        duration: 140,
        ease: "Sine.easeOut",
        onComplete: () => resolve(),
      });
    });

    const flipDuration = 120;
    const flipRepeats = 6;
    await new Promise<void>((resolve) => {
      let finished = 0;
      const done = () => {
        finished += 1;
        if (finished >= 2) resolve();
      };
      this.scene.tweens.add({
        targets: this.coin,
        scaleX: 0.08,
        duration: flipDuration,
        yoyo: true,
        repeat: flipRepeats,
        ease: "Sine.easeInOut",
        onComplete: () => done(),
      });
      this.scene.tweens.add({
        targets: this.coin,
        angle: 360,
        duration: flipDuration * (flipRepeats + 1) * 2,
        ease: "Sine.easeInOut",
        onComplete: () => done(),
      });
    });

    await new Promise<void>((resolve) => {
      this.scene.tweens.add({
        targets: this.container,
        alpha: 0,
        scale: 1.04,
        duration: 180,
        ease: "Sine.easeIn",
        onComplete: () => resolve(),
      });
    });

    this.destroy();
    this.active = false;
  }

  private destroy() {
    this.container?.destroy();
    this.container = undefined;
    this.coin = undefined;
  }
}
