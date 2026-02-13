import Phaser from "phaser";
import { UI_LAYOUT } from "./UiLayoutConfig";
import { PreviewController } from "./PreviewController";
import { DrawHelpers } from "./HeaderHandler";
import { HandLayoutRenderer } from "./HandLayoutRenderer";
import type { Palette } from "./types";
import { ScrollList } from "./ScrollList";
import { TrashCardGridRenderer } from "./TrashCardGridRenderer";
import { DEFAULT_CARD_DIALOG_CONFIG, computeDialogLayout, createDialogShell } from "./CardDialogLayout";

type TrashAreaDialogShowOpts = {
  cards: any[];
  header?: string;
  closeOnBackdrop?: boolean;
  showCloseButton?: boolean;
  onClose?: () => void;
};

export class TrashAreaDialog {
  protected overlay?: Phaser.GameObjects.Rectangle;
  protected dialog?: Phaser.GameObjects.Container;
  protected content?: Phaser.GameObjects.Container;
  protected open = false;
  protected previewController: PreviewController;
  protected previewLayout: HandLayoutRenderer;
  protected scrollList?: ScrollList;
  protected gridRenderer: TrashCardGridRenderer;
  protected lastOnClose?: (() => void) | undefined;

  protected cfg = DEFAULT_CARD_DIALOG_CONFIG;

  constructor(protected scene: Phaser.Scene) {
    this.previewController = new PreviewController(scene, {
      overlayAlpha: UI_LAYOUT.hand.preview.overlayAlpha,
      fadeIn: UI_LAYOUT.hand.preview.fadeIn,
      fadeOut: UI_LAYOUT.hand.preview.fadeOut,
      holdDelay: UI_LAYOUT.hand.preview.holdDelay,
      depth: 14000,
    });
    const palette: Palette = {
      ink: "#0f1118",
      slot: "#2a2d38",
      accent: "#d0d5e0",
      text: "#f5f6fb",
      bg: "#ffffff",
    };
    const drawHelpers = new DrawHelpers(scene);
    this.previewLayout = new HandLayoutRenderer(scene, palette, drawHelpers);
    this.gridRenderer = new TrashCardGridRenderer(scene);
  }

  async hide(): Promise<void> {
    this.previewController.hide(true);
    this.overlay?.destroy();
    this.dialog?.destroy();
    this.scrollList?.destroy();
    this.overlay = undefined;
    this.dialog = undefined;
    this.content = undefined;
    this.scrollList = undefined;
    const onClose = this.lastOnClose;
    this.lastOnClose = undefined;
    this.open = false;
    onClose?.();
  }

  isOpen() {
    return this.open;
  }

  show(opts: TrashAreaDialogShowOpts) {
    this.hide();
    const cam = this.scene.cameras.main;
    const closeOnBackdrop = opts.closeOnBackdrop ?? true;
    const showCloseButton = opts.showCloseButton ?? true;
    this.lastOnClose = opts.onClose;
    const cards = Array.isArray(opts.cards) ? opts.cards : [];
    const headerText = opts.header || "Trash Area";

    const layout = computeDialogLayout(cam, this.cfg, {
      cols: this.cfg.dialog.cols,
      visibleRows: this.cfg.dialog.visibleRows,
    });
    const { dialog, overlay, content } = createDialogShell(this.scene, this.cfg, layout, {
      centerX: cam.centerX,
      centerY: cam.centerY,
      headerText,
      showOverlay: true,
      closeOnBackdrop,
      showCloseButton,
      onClose: () => {
        void this.hide();
      },
    });
    this.dialog = dialog;
    this.overlay = overlay;
    this.content = content;

    const startX = -layout.dialogWidth / 2 + layout.margin + layout.cellWidth / 2;
    const headerFontSize = this.cfg.dialog.headerFontSize ?? 20;
    const headerHeight = headerFontSize + 12;
    const topInset = layout.headerOffset + headerHeight + Math.max(10, layout.gap - 4);
    const startY = -layout.dialogHeight / 2 + topInset + layout.cellHeight / 2;
    const cardConfig = {
      ...this.cfg.card,
      framePadding: Math.max(2, this.cfg.card.framePadding - 4),
      frameExtra: { ...this.cfg.card.frameExtra, h: 0 },
    };

    const { contentHeight } = this.gridRenderer.render({
      container: content,
      cards,
      cols: layout.cols,
      gap: layout.gap,
      startX,
      startY,
      cellWidth: layout.cellWidth,
      cellHeight: layout.cellHeight,
      cardConfig,
      badgeConfig: this.cfg.badge,
      typeOverrides: this.cfg.cardTypeOverrides,
      onPointerDown: (card) => this.startPreview(card),
      onPointerUp: () => {
        if (this.previewController.isActive()) return;
        this.previewController.cancelPending();
      },
      onPointerOut: () => {
        if (this.previewController.isActive()) return;
        this.previewController.cancelPending();
      },
    });

    if (!cards.length) {
      const empty = this.scene.add.text(0, startY, "Trash is empty", {
        fontSize: "15px",
        fontFamily: "Arial",
        color: "#d7d9dd",
        align: "center",
      }).setOrigin(0.5);
      dialog.add(empty);
    }

    const gridWidth = layout.dialogWidth - layout.margin * 2;
    const scrollBounds = {
      x: -layout.dialogWidth / 2 + layout.margin,
      y: startY - layout.cellHeight / 2,
      width: gridWidth,
      height: layout.gridVisibleHeight,
    };
    const trackX = layout.dialogWidth / 2 - this.cfg.dialog.scrollbarWidth / 2 - this.cfg.dialog.scrollbarPad;
    this.scrollList = new ScrollList(this.scene, dialog, content, scrollBounds, {
      width: this.cfg.dialog.scrollbarWidth,
      pad: this.cfg.dialog.scrollbarPad,
      minThumb: this.cfg.dialog.scrollbarMinThumb,
      trackX,
    }, {
      onDragStart: () => {
        this.previewController.hide(true);
      },
    });
    this.scrollList.setContentHeight(contentHeight);
    this.scrollList.attach();

    this.open = true;
  }

  private startPreview(card: any) {
    const cardW = UI_LAYOUT.hand.preview.cardWidth;
    const cardH = cardW * UI_LAYOUT.hand.preview.cardAspect;
    this.previewController.start((container) => {
      const preview = this.gridRenderer.getPreviewData(card);
      const textureKey = this.resolveNonPreviewTextureKey(preview.textureKey);
      this.previewLayout.renderPreview(container, 0, 0, cardW, cardH, textureKey, preview.statLabel, preview.previewCard, {
        badgeSize: UI_LAYOUT.hand.preview.badgeSize,
        badgeFontSize: UI_LAYOUT.hand.preview.badgeFontSize,
      });
    });
  }

  private resolveNonPreviewTextureKey(textureKey?: string) {
    if (!textureKey) return textureKey;
    const key = String(textureKey);
    const baseKey = key.replace(/-preview$/i, "");
    if (baseKey !== key && this.scene.textures.exists(baseKey)) return baseKey;
    return key;
  }
}
