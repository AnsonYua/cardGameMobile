import { TrashAreaDialog } from "./TrashAreaDialog";
import { computeDialogLayout, createDialogShell } from "./CardDialogLayout";
import { buildPopupBadgeConfigs } from "./PopupBadgeScaling";

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
  showCardsPopup(opts: {
    cards: any[];
    header?: string;
    fadeInMs?: number;
    holdMs?: number;
    fadeOutMs?: number;
    showOverlay?: boolean;
    centerY?: number;
    maxCols?: number;
  }): Promise<void> {
    this.hide();
    const cam = this.scene.cameras.main;
    const showOverlay = opts.showOverlay ?? false;
    const headerText = opts.header || "Move to Trash";
    const fadeInMs = opts.fadeInMs ?? 160;
    const holdMs = opts.holdMs ?? 700;
    const fadeOutMs = opts.fadeOutMs ?? 220;
    const centerY = opts.centerY ?? cam.centerY;
    const cards = Array.isArray(opts.cards) ? opts.cards.filter(Boolean) : [];

    const maxCols = Math.max(1, Math.floor(opts.maxCols ?? this.cfg.dialog.cols));
    const cols = Math.max(1, Math.min(maxCols, cards.length || 1));
    const visibleRows = Math.max(1, Math.min(2, Math.ceil((cards.length || 1) / cols)));

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

    const startX = -layout.dialogWidth / 2 + layout.margin + layout.cellWidth / 2;
    const startY = -layout.dialogHeight / 2 + layout.headerOffset + 40 + layout.cellHeight / 2;

    const { badgeConfig, typeOverrides } = buildPopupBadgeConfigs(this.cfg, cols);

    this.gridRenderer.render({
      container: content,
      cards,
      cols,
      gap: layout.gap,
      startX,
      startY,
      cellWidth: layout.cellWidth,
      cellHeight: layout.cellHeight,
      cardConfig: this.cfg.card,
      badgeConfig,
      typeOverrides,
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

  showDrawPopup(opts: DrawPopupOpts): Promise<void> {
    return this.showCardsPopup({
      cards: [opts.card],
      header: opts.header || "Card Drawn",
      fadeInMs: opts.fadeInMs,
      holdMs: opts.holdMs,
      fadeOutMs: opts.fadeOutMs,
      showOverlay: opts.showOverlay,
      centerY: opts.centerY,
      maxCols: 1,
    });
  }
}
