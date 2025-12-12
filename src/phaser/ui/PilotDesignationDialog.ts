import Phaser from "phaser";

type PilotDesignationDialogOpts = {
  onPilot: () => Promise<void> | void;
  onCommand: () => Promise<void> | void;
  onClose?: () => void;
};

/**
 * Simple two-option dialog (Pilot / Command) for pilot-designation commands.
 * Renders its own overlay and panel; exposes show/hide so BoardScene stays lean.
 */
export class PilotDesignationDialog {
  private overlay?: Phaser.GameObjects.Rectangle;
  private container?: Phaser.GameObjects.Container;

  constructor(private scene: Phaser.Scene) {}

  show(opts: PilotDesignationDialogOpts) {
    // If already created, just show.
    if (this.container && this.overlay) {
      this.overlay.setVisible(true).setInteractive({ useHandCursor: true });
      this.container.setVisible(true);
      return;
    }

    const cam = this.scene.cameras.main;
    const overlay = this.scene.add
      .rectangle(cam.centerX, cam.centerY, cam.width, cam.height, 0x000000, 0.45)
      .setInteractive({ useHandCursor: true })
      .setDepth(2499);
    overlay.on("pointerup", () => {
      void this.hide(opts.onClose);
    });

    const dialogWidth = Math.max(320, cam.width * 0.7);
    const dialogHeight = 190;
    const dialog = this.scene.add.container(cam.centerX, cam.centerY);

    const panel = this.scene.add.graphics({ x: 0, y: 0 });
    panel.fillStyle(0x1f6bff, 1);
    panel.fillRoundedRect(-dialogWidth / 2, -dialogHeight / 2, dialogWidth, dialogHeight, 18);
    panel.lineStyle(3, 0x0e3f9c, 1);
    panel.strokeRoundedRect(-dialogWidth / 2, -dialogHeight / 2, dialogWidth, dialogHeight, 18);

    const closeSize = 24;
    const closeButton = this.scene.add
      .rectangle(dialogWidth / 2 - closeSize - 12, -dialogHeight / 2 + closeSize + 12, closeSize, closeSize, 0xffffff, 0.14)
      .setStrokeStyle(2, 0xffffff, 0.6)
      .setInteractive({ useHandCursor: true });
    closeButton.on("pointerup", () => {
      void this.hide(opts.onClose);
    });
    const closeLabel = this.scene.add
      .text(closeButton.x, closeButton.y, "✕", {
        fontSize: "16px",
        fontFamily: "Arial",
        color: "#f6f8ff",
        align: "center",
      })
      .setOrigin(0.5);

    const header = this.scene.add
      .text(0, -dialogHeight / 2 + 45, "Play Card As", {
        fontSize: "22px",
        fontFamily: "Arial",
        fontStyle: "bold",
        color: "#f6f8ff",
        align: "center",
        wordWrap: { width: dialogWidth - 80 },
      })
      .setOrigin(0.5);

    const dialogMargin = 32;
    const buttonGap = 24;
    const availableForButtons = Math.max(160, dialogWidth - dialogMargin * 2);
    const buttonWidth = Math.min(220, (availableForButtons - buttonGap) / 2);
    const buttonHeight = 46;
    const btnY = dialogHeight / 2 - 60;

    const makeButton = (x: number, label: string, onClick: () => Promise<void> | void) => {
      const rect = this.scene.add.rectangle(x, btnY, buttonWidth, buttonHeight, 0xf2f5ff, 1);
      rect.setStrokeStyle(2, 0xffffff, 0.9);
      rect.setInteractive({ useHandCursor: true });
      rect.on("pointerup", async () => {
        await onClick();
      });

      const txt = this.scene.add.text(x, btnY, label, {
        fontSize: "15px",
        fontFamily: "Arial",
        fontStyle: "bold",
        color: "#1f3f9c",
        align: "center",
        wordWrap: { width: buttonWidth - 18 },
      });
      txt.setOrigin(0.5);
      return [rect, txt];
    };

    const offset = buttonWidth / 2 + buttonGap / 2;
    const [pilotBtn, pilotTxt] = makeButton(-offset, "Pilot", async () => {
      await this.hide(opts.onClose);
      await opts.onPilot();
    });
    const [commandBtn, commandTxt] = makeButton(offset, "Command", async () => {
      await opts.onCommand();
      await this.hide(opts.onClose);
    });

    dialog.add([panel, closeButton, closeLabel, header, pilotBtn, pilotTxt, commandBtn, commandTxt]);
    dialog.setDepth(2500);

    this.overlay = overlay;
    this.container = this.scene.add.container(0, 0, [overlay, dialog]).setDepth(2498);
  }

  async hide(onClose?: () => void): Promise<void> {
    this.overlay?.setVisible(false).disableInteractive();
    this.container?.setVisible(false);
    onClose?.();
  }
}
