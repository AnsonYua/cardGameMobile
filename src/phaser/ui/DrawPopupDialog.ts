import { TrashAreaDialog } from "./TrashAreaDialog";
import { computeDialogLayout, createDialogShell } from "./CardDialogLayout";

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

    const cols = this.cfg.dialog.cols;
    const visibleRows = 1;

    const layout = computeDialogLayout(cam, this.cfg, { cols, visibleRows });
    const { dialog, overlay, content } = createDialogShell(this.scene, this.cfg, layout, {
      centerX: cam.centerX,
      centerY,
      headerText,
      showOverlay,
      closeOnBackdrop: false,
      showCloseButton: false,
    });
    this.dialog = dialog;
    this.overlay = overlay;
    this.content = content;
    this.open = true;

    const colIndex = Math.floor(cols / 2);
    const startX = -layout.dialogWidth / 2 + layout.margin + layout.cellWidth / 2 + colIndex * (layout.cellWidth + layout.gap);
    const startY = -layout.dialogHeight / 2 + layout.headerOffset + 40 + layout.cellHeight / 2;

    this.gridRenderer.render({
      container: content,
      cards: [opts.card],
      cols,
      gap: layout.gap,
      startX,
      startY,
      cellWidth: layout.cellWidth,
      cellHeight: layout.cellHeight,
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
