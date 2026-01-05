import Phaser from "phaser";
import { UI_LAYOUT } from "./UiLayoutConfig";
import { PreviewController } from "./PreviewController";
import { DrawHelpers } from "./HeaderHandler";
import { HandLayoutRenderer } from "./HandLayoutRenderer";
import type { Palette } from "./types";
import { ScrollList } from "./ScrollList";
import { TrashCardGridRenderer } from "./TrashCardGridRenderer";

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

  protected cfg = {
    z: { overlay: 12000, dialog: 12001 },
    overlayAlpha: 0.45,
    dialog: {
      cols: 3,
      visibleRows: 2,
      margin: 20,
      gap: 20,
      widthFactor: 0.82,
      minWidth: 360,
      minHeight: 260,
      panelRadius: 18,
      extraHeight: 110,
      headerOffset: 36,
      closeSize: 22,
      closeOffset: 12,
      headerWrapPad: 80,
      scrollbarWidth: 8,
      scrollbarPad: 6,
      scrollbarMinThumb: 24,
    },
    card: {
      aspect: 88 / 64,
      widthFactor: 1,
      framePadding: 8,
      frameExtra: { w: 0, h: 36 },
      frameStroke: 0,
      frameColor: 0xffffff,
      extraCellHeight: 20,
    },
    badge: {
      size: { w: 30, h: 15 },
      fontSize: 12,
      insetX: 4,
      insetY: 4,
      fill: 0x000000,
      alpha: 0.9,
      offsets: {
        default: { x: 0, y: 0 },
        unit: { x: 0, y: 0 },
        pilot: { x: 0, y: -6 },
        base: { x: 0, y: 0 },
        command: { x: 0, y: -2 },
        pilotCommand: { x: 0, y: -10 },
      },
    },
    cardTypeOverrides: {
      unit: { size: { w: 30, h: 15 }, fontSize: 12, insetX: 0, insetY: 0 },
      pilot: { size: { w: 30, h: 15 }, fontSize: 12, insetX: -5, insetY: 10 },
      base: { size: { w: 30, h: 15 }, fontSize: 12, insetX: 0, insetY: 0 },
      pilotCommand: { size: { w: 30, h: 15 }, fontSize: 12, insetX: -3, insetY: -10 },
      default: { size: { w: 30, h: 15 }, fontSize: 12, insetX: 0, insetY: 0},
    },
  };

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

    const {
      cols,
      visibleRows,
      margin,
      gap,
      widthFactor,
      minWidth,
      minHeight,
      extraHeight,
      panelRadius,
      headerOffset,
      closeSize,
      closeOffset,
      headerWrapPad,
      scrollbarWidth,
      scrollbarPad,
      scrollbarMinThumb,
    } = this.cfg.dialog;
    const { aspect, extraCellHeight } = this.cfg.card;

    const dialogWidth = Math.max(minWidth, cam.width * widthFactor);
    const cellWidth = (dialogWidth - margin * 2 - gap * (cols - 1)) / cols;
    const cardHeight = cellWidth * aspect;
    const cellHeight = cardHeight + extraCellHeight;
    const gridVisibleHeight = visibleRows * cellHeight + (visibleRows - 1) * gap;
    const dialogHeight = Math.max(minHeight, gridVisibleHeight + extraHeight);
    const gridWidth = dialogWidth - margin * 2;

    const dialog = this.scene.add.container(cam.centerX, cam.centerY);
    dialog.setDepth(this.cfg.z.dialog);
    this.dialog = dialog;

    const overlay = this.scene.add
      .rectangle(0, 0, cam.width, cam.height, 0x000000, this.cfg.overlayAlpha)
      .setInteractive({ useHandCursor: closeOnBackdrop });
    if (closeOnBackdrop) {
      overlay.on("pointerup", () => {
        void this.hide();
      });
    }
    dialog.add(overlay);
    this.overlay = overlay;

    const panel = this.scene.add.graphics({ x: 0, y: 0 });
    panel.fillStyle(0x3a3d42, 0.95);
    panel.fillRoundedRect(-dialogWidth / 2, -dialogHeight / 2, dialogWidth, dialogHeight, panelRadius);
    panel.lineStyle(2, 0x5b6068, 1);
    panel.strokeRoundedRect(-dialogWidth / 2, -dialogHeight / 2, dialogWidth, dialogHeight, panelRadius);
    dialog.add(panel);

    let closeButton: Phaser.GameObjects.Rectangle | undefined;
    let closeLabel: Phaser.GameObjects.Text | undefined;
    if (showCloseButton) {
      closeButton = this.scene.add.rectangle(
        dialogWidth / 2 - closeSize - closeOffset,
        -dialogHeight / 2 + closeSize + closeOffset,
        closeSize,
        closeSize,
        0xffffff,
        0.12,
      );
      closeButton.setStrokeStyle(2, 0xffffff, 0.5);
      closeButton.setInteractive({ useHandCursor: true });
      closeButton.on("pointerup", () => {
        void this.hide();
      });
      closeLabel = this.scene.add
        .text(closeButton.x, closeButton.y, "✕", { fontSize: "15px", fontFamily: "Arial", color: "#f5f6f7", align: "center" })
        .setOrigin(0.5);
      closeLabel.setInteractive({ useHandCursor: true });
      closeLabel.on("pointerup", () => {
        void this.hide();
      });
    }

    const header = this.scene.add.text(0, -dialogHeight / 2 + headerOffset, headerText, {
      fontSize: "20px",
      fontFamily: "Arial",
      fontStyle: "bold",
      color: "#f5f6f7",
      align: "center",
      wordWrap: { width: dialogWidth - headerWrapPad },
    }).setOrigin(0.5);

    const startX = -dialogWidth / 2 + margin + cellWidth / 2;
    const startY = -dialogHeight / 2 + headerOffset + 40 + cellHeight / 2;

    const content = this.scene.add.container(0, 0);
    this.content = content;
    dialog.add(content);

    const { contentHeight } = this.gridRenderer.render({
      container: content,
      cards,
      cols,
      gap,
      startX,
      startY,
      cellWidth,
      cellHeight,
      cardConfig: this.cfg.card,
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

    const scrollBounds = {
      x: -dialogWidth / 2 + margin,
      y: startY - cellHeight / 2,
      width: gridWidth,
      height: gridVisibleHeight,
    };
    const trackX = dialogWidth / 2 - scrollbarWidth / 2 - scrollbarPad;
    this.scrollList = new ScrollList(this.scene, dialog, content, scrollBounds, {
      width: scrollbarWidth,
      pad: scrollbarPad,
      minThumb: scrollbarMinThumb,
      trackX,
    });
    this.scrollList.setContentHeight(contentHeight);
    this.scrollList.attach();

    dialog.add([header]);
    if (showCloseButton && closeButton && closeLabel) {
      dialog.add([closeButton, closeLabel]);
    }
    dialog.setDepth(this.cfg.z.dialog);
    this.scene.add.existing(dialog);
    this.open = true;
  }

  private startPreview(card: any) {
    const cardW = UI_LAYOUT.hand.preview.cardWidth;
    const cardH = cardW * UI_LAYOUT.hand.preview.cardAspect;
    this.previewController.start((container) => {
      const preview = this.gridRenderer.getPreviewData(card);
      this.previewLayout.renderPreview(container, 0, 0, cardW, cardH, preview.textureKey, preview.statLabel, preview.previewCard, {
        badgeSize: UI_LAYOUT.hand.preview.badgeSize,
        badgeFontSize: UI_LAYOUT.hand.preview.badgeFontSize,
      });
    });
  }
}
