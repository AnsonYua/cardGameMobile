import type Phaser from "phaser";

export type TargetDialogShellConfig = {
  z: { overlay: number; dialog: number };
  overlayAlpha: number;
  panelRadius: number;
  closeSize: number;
  closeOffset: number;
};

export function createTargetDialogShell(
  scene: Phaser.Scene,
  cfg: TargetDialogShellConfig,
  layout: { dialogWidth: number; dialogHeight: number },
  opts: {
    closeOnBackdrop: boolean;
    showCloseButton: boolean;
    onClose: () => void;
  },
) {
  let closing = false;
  const requestClose = () => {
    if (closing) return;
    closing = true;
    opts.onClose();
  };
  const cam = scene.cameras.main;

  const dialog = scene.add.container(cam.centerX, cam.centerY);
  dialog.setDepth(cfg.z.dialog);

  const overlay = scene.add
    .rectangle(0, 0, cam.width, cam.height, 0x000000, cfg.overlayAlpha)
    .setInteractive({ useHandCursor: opts.closeOnBackdrop });
  if (opts.closeOnBackdrop) overlay.on("pointerup", () => requestClose());
  dialog.add(overlay);

  const panel = scene.add.graphics({ x: 0, y: 0 });
  panel.fillStyle(0x3a3d42, 0.95);
  panel.fillRoundedRect(-layout.dialogWidth / 2, -layout.dialogHeight / 2, layout.dialogWidth, layout.dialogHeight, cfg.panelRadius);
  panel.lineStyle(2, 0x5b6068, 1);
  panel.strokeRoundedRect(-layout.dialogWidth / 2, -layout.dialogHeight / 2, layout.dialogWidth, layout.dialogHeight, cfg.panelRadius);
  dialog.add(panel);

  // Content should be below the close button so it can't steal clicks outside the scroll mask.
  const content = scene.add.container(0, 0);
  dialog.add(content);

  let closeButton: Phaser.GameObjects.Rectangle | undefined;
  let closeLabel: Phaser.GameObjects.Text | undefined;
  if (opts.showCloseButton) {
    const closeSize = cfg.closeSize;
    const closeOffset = cfg.closeOffset;
    closeButton = scene.add.rectangle(
      layout.dialogWidth / 2 - closeSize - closeOffset,
      -layout.dialogHeight / 2 + closeSize + closeOffset - 10,
      closeSize,
      closeSize,
      0xffffff,
      0.12,
    );
    closeButton.setStrokeStyle(2, 0xffffff, 0.5);
    closeButton.setInteractive({ useHandCursor: true });
    closeButton.on("pointerdown", () => requestClose());
    closeButton.on("pointerup", () => requestClose());
    closeLabel = scene.add
      .text(closeButton.x, closeButton.y, "✕", { fontSize: "15px", fontFamily: "Arial", color: "#f5f6f7", align: "center" })
      .setOrigin(0.5);
    closeLabel.setInteractive({ useHandCursor: true });
    closeLabel.on("pointerdown", () => requestClose());
    closeLabel.on("pointerup", () => requestClose());
    dialog.add([closeButton, closeLabel]);
  }

  return { overlay, dialog, content, closeButton, closeLabel };
}
