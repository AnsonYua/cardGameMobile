import Phaser from "phaser";

type TimerBarOptions = {
  width: number;
  height: number;
  fillColor?: number;
  bgColor?: number;
  borderColor?: number;
  textColor?: string;
  fontSize?: number;
  showLabel?: boolean;
};

export class TimerBar {
  private container: Phaser.GameObjects.Container;
  private bg: Phaser.GameObjects.Rectangle;
  private fill: Phaser.GameObjects.Rectangle;
  private label?: Phaser.GameObjects.Text;
  private width: number;
  private height: number;

  constructor(private scene: Phaser.Scene, opts: TimerBarOptions) {
    this.width = opts.width;
    this.height = opts.height;
    const bgColor = opts.bgColor ?? 0x0f1118;
    const fillColor = opts.fillColor ?? 0x4b79ff;
    const borderColor = opts.borderColor ?? 0x5b6068;
    const fontSize = opts.fontSize ?? 12;
    const textColor = opts.textColor ?? "#f5f6f7";
    const showLabel = opts.showLabel ?? false;

    this.container = this.scene.add.container(0, 0);
    this.bg = this.scene.add.rectangle(0, 0, this.width, this.height, bgColor, 0.9).setOrigin(0, 0.5);
    this.bg.setStrokeStyle(1, borderColor, 0.8);
    this.fill = this.scene.add.rectangle(0, 0, this.width, this.height, fillColor, 1).setOrigin(0, 0.5);
    if (showLabel) {
      this.label = this.scene.add
        .text(this.width, 0, "", { fontSize: `${fontSize}px`, fontFamily: "Arial", color: textColor })
        .setOrigin(1, 0.5);
    }
    this.container.add([this.bg, this.fill, ...(this.label ? [this.label] : [])]);
  }

  addTo(parent: Phaser.GameObjects.Container) {
    parent.add(this.container);
  }

  setPosition(x: number, y: number) {
    this.container.setPosition(x, y);
  }

  setProgress(progress: number, secondsLeft: number) {
    const clamped = Math.max(0, Math.min(1, progress));
    this.fill.setDisplaySize(this.width * clamped, this.height);
    this.label?.setText(`${secondsLeft}s`);
  }

  setVisible(visible: boolean) {
    this.container.setVisible(visible);
  }

  setDepth(depth: number) {
    this.container.setDepth(depth);
  }

  destroy() {
    this.container.destroy();
  }
}
