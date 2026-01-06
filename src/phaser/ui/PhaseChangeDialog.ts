import { DEFAULT_CARD_DIALOG_CONFIG } from "./CardDialogLayout";

export type PhaseChangePopupOpts = {
  nextPhase: string;
  header?: string;
  fadeInMs?: number;
  holdMs?: number;
  fadeOutMs?: number;
  centerY?: number;
  showOverlay?: boolean;
};

export class PhaseChangeDialog {
  private cfg = DEFAULT_CARD_DIALOG_CONFIG;
  private dialog?: Phaser.GameObjects.Container;
  private overlay?: Phaser.GameObjects.Rectangle;
  private open = false;

  constructor(private scene: Phaser.Scene) {}

  async hide(): Promise<void> {
    this.overlay?.destroy();
    this.dialog?.destroy();
    this.overlay = undefined;
    this.dialog = undefined;
    this.open = false;
  }

  showPhaseChange(opts: PhaseChangePopupOpts): Promise<void> {
    this.hide();
    const cam = this.scene.cameras.main;
    const camCenterX = cam.scrollX + cam.width / 2;
    const camCenterY = cam.scrollY + cam.height / 2;
    const headerText = opts.header || "Phase Change";
    const fadeInMs = opts.fadeInMs ?? 160;
    const holdMs = opts.holdMs ?? 800;
    const fadeOutMs = opts.fadeOutMs ?? 220;
    const centerY = opts.centerY ?? cam.scrollY + cam.height * 0.18;
    const centerX = camCenterX;
    const showOverlay = opts.showOverlay ?? false;

    const dialog = this.scene.add.container(centerX, centerY);
    dialog.setDepth(this.cfg.z.dialog);
    this.dialog = dialog;
    this.open = true;

    if (showOverlay) {
      const overlay = this.scene.add
        .rectangle(0, 0, cam.width, cam.height, 0x000000, this.cfg.overlayAlpha)
        .setInteractive({ useHandCursor: false });
      dialog.add(overlay);
      this.overlay = overlay;
    }

    const header = this.scene.add.text(0, 0, headerText, {
      fontSize: "20px",
      fontFamily: "Arial",
      fontStyle: "bold",
      color: "#f5f6f7",
      align: "center",
    }).setOrigin(0.5);
    const label = this.scene.add.text(0, 0, opts.nextPhase || "", {
      fontSize: "20px",
      fontFamily: "Arial",
      fontStyle: "bold",
      color: "#f5f6f7",
      align: "center",
    }).setOrigin(0.5);

    const paddingX = 40;
    const paddingY = 26;
    const gap = 12;
    const contentWidth = Math.max(header.width, label.width);
    const contentHeight = header.height + gap + label.height;
    const dialogWidth = Math.min(cam.width * 0.75, contentWidth + paddingX * 2);
    const dialogHeight = contentHeight + paddingY * 2;

    const panel = this.scene.add.graphics({ x: 0, y: 0 });
    panel.fillStyle(0x3a3d42, 0.95);
    panel.fillRoundedRect(-dialogWidth / 2, -dialogHeight / 2, dialogWidth, dialogHeight, this.cfg.dialog.panelRadius);
    panel.lineStyle(2, 0x5b6068, 1);
    panel.strokeRoundedRect(-dialogWidth / 2, -dialogHeight / 2, dialogWidth, dialogHeight, this.cfg.dialog.panelRadius);

    const headerY = -dialogHeight / 2 + paddingY + header.height / 2;
    const labelY = headerY + header.height / 2 + gap + label.height / 2;
    header.setY(headerY);
    label.setY(labelY);

    dialog.add([panel, header, label]);

    dialog.setAlpha(0).setScale(0.96);
    return new Promise<void>((resolve) => {
      this.scene.tweens.add({
        targets: dialog,
        alpha: 1,
        scale: 1,
        duration: fadeInMs,
        ease: "Back.easeOut",
        onComplete: () => {
          this.scene.time.delayedCall(holdMs, () => {
            this.scene.tweens.add({
              targets: dialog,
              alpha: 0,
              scale: 1.02,
              duration: fadeOutMs,
              ease: "Sine.easeIn",
              onComplete: () => {
                void this.hide();
                resolve();
              },
            });
          });
        },
      });
    });
  }
}
