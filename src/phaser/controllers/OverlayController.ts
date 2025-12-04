import Phaser from "phaser";

export class OverlayController {
  private label?: Phaser.GameObjects.Text;
  private currentMessage = "";
  private depth = 1200;

  constructor(private scene: Phaser.Scene) {}

  show(message: string, x: number, y: number) {
    this.currentMessage = message;
    if (this.label) {
      this.label.setText(message).setPosition(x, y).setVisible(true);
      return;
    }
    this.label = this.scene.add
      .text(x, y, message, {
        fontSize: "18px",
        fontFamily: "Arial",
        color: "#ffffff",
        backgroundColor: "#00000088",
        padding: { x: 10, y: 6 },
      })
      .setOrigin(0.5)
      .setDepth(this.depth);
  }

  hide() {
    this.label?.setVisible(false);
  }

  destroy() {
    this.label?.destroy();
    this.label = undefined;
  }
}
