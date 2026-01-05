import { TrashAreaDialog } from "./TrashAreaDialog";

export type DrawPopupOpts = {
  card: any;
  header?: string;
  fadeInMs?: number;
  holdMs?: number;
  fadeOutMs?: number;
  showOverlay?: boolean;
  centerY?: number;
};

export class DrawPopupDialog extends TrashAreaDialog {
  showDrawPopup(opts: DrawPopupOpts): Promise<void> {
    this.hide();
    const cam = this.scene.cameras.main;
    const showOverlay = opts.showOverlay ?? false;
    const headerText = opts.header || "Card Drawn";
    const fadeInMs = opts.fadeInMs ?? 160;
    const holdMs = opts.holdMs ?? 700;
    const fadeOutMs = opts.fadeOutMs ?? 220;
    const centerY = opts.centerY ?? cam.centerY;

    const {
      margin,
      gap,
      widthFactor,
      minWidth,
      minHeight,
      extraHeight,
      panelRadius,
      headerOffset,
      headerWrapPad,
    } = this.cfg.dialog;
    const { aspect, extraCellHeight } = this.cfg.card;
    const cols = this.cfg.dialog.cols;
    const visibleRows = 1;

    const dialogWidth = Math.max(minWidth, cam.width * widthFactor);
    const cellWidth = (dialogWidth - margin * 2 - gap * (cols - 1)) / cols;
    const cardHeight = cellWidth * aspect;
    const cellHeight = cardHeight + extraCellHeight;
    const gridVisibleHeight = visibleRows * cellHeight + (visibleRows - 1) * gap;
    const dialogHeight = Math.max(minHeight, gridVisibleHeight + extraHeight);

    const dialog = this.scene.add.container(cam.centerX, centerY);
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

    const panel = this.scene.add.graphics({ x: 0, y: 0 });
    panel.fillStyle(0x3a3d42, 0.95);
    panel.fillRoundedRect(-dialogWidth / 2, -dialogHeight / 2, dialogWidth, dialogHeight, panelRadius);
    panel.lineStyle(2, 0x5b6068, 1);
    panel.strokeRoundedRect(-dialogWidth / 2, -dialogHeight / 2, dialogWidth, dialogHeight, panelRadius);
    dialog.add(panel);

    const header = this.scene.add.text(0, -dialogHeight / 2 + headerOffset, headerText, {
      fontSize: "20px",
      fontFamily: "Arial",
      fontStyle: "bold",
      color: "#f5f6f7",
      align: "center",
      wordWrap: { width: dialogWidth - headerWrapPad },
    }).setOrigin(0.5);
    dialog.add(header);

    const colIndex = Math.floor(cols / 2);
    const startX = -dialogWidth / 2 + margin + cellWidth / 2 + colIndex * (cellWidth + gap);
    const startY = -dialogHeight / 2 + headerOffset + 40 + cellHeight / 2;
    const content = this.scene.add.container(0, 0);
    this.content = content;
    dialog.add(content);

    this.gridRenderer.render({
      container: content,
      cards: [opts.card],
      cols,
      gap,
      startX,
      startY,
      cellWidth,
      cellHeight,
      cardConfig: this.cfg.card,
      badgeConfig: this.cfg.badge,
      typeOverrides: this.cfg.cardTypeOverrides,
    });

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
