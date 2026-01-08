import Phaser from "phaser";

export type CardDialogConfig = {
  z: { overlay: number; dialog: number };
  overlayAlpha: number;
  dialog: {
    cols: number;
    visibleRows: number;
    margin: number;
    gap: number;
    widthFactor: number;
    minWidth: number;
    minHeight: number;
    panelRadius: number;
    extraHeight: number;
    headerOffset: number;
    closeSize: number;
    closeOffset: number;
    headerWrapPad: number;
    scrollbarWidth: number;
    scrollbarPad: number;
    scrollbarMinThumb: number;
  };
  card: {
    aspect: number;
    widthFactor: number;
    framePadding: number;
    frameExtra: { w: number; h: number };
    frameStroke: number;
    frameColor: number;
    extraCellHeight: number;
  };
  badge: {
    size: { w: number; h: number };
    fontSize: number;
    insetX: number;
    insetY: number;
    fill: number;
    alpha: number;
    offsets: {
      default: { x: number; y: number };
      unit: { x: number; y: number };
      pilot: { x: number; y: number };
      base: { x: number; y: number };
      command: { x: number; y: number };
      pilotCommand: { x: number; y: number };
    };
  };
  cardTypeOverrides: {
    unit: { size: { w: number; h: number }; fontSize: number; insetX: number; insetY: number };
    pilot: { size: { w: number; h: number }; fontSize: number; insetX: number; insetY: number };
    base: { size: { w: number; h: number }; fontSize: number; insetX: number; insetY: number };
    pilotCommand: { size: { w: number; h: number }; fontSize: number; insetX: number; insetY: number };
    default: { size: { w: number; h: number }; fontSize: number; insetX: number; insetY: number };
  };
};

export const DEFAULT_CARD_DIALOG_CONFIG: CardDialogConfig = {
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
    default: { size: { w: 30, h: 15 }, fontSize: 12, insetX: 0, insetY: 0 },
  },
};

export type DialogLayout = {
  dialogWidth: number;
  dialogHeight: number;
  cellWidth: number;
  cellHeight: number;
  cardHeight: number;
  gridVisibleHeight: number;
  margin: number;
  gap: number;
  headerOffset: number;
  headerWrapPad: number;
  cols: number;
  visibleRows: number;
};

export function computeDialogLayout(
  cam: Phaser.Cameras.Scene2D.Camera,
  config: CardDialogConfig,
  overrides: { cols?: number; visibleRows?: number } = {},
): DialogLayout {
  const cols = overrides.cols ?? config.dialog.cols;
  const visibleRows = overrides.visibleRows ?? config.dialog.visibleRows;
  const { margin, gap, widthFactor, minWidth, minHeight, extraHeight, headerOffset, headerWrapPad } = config.dialog;
  const { aspect, extraCellHeight } = config.card;
  const dialogWidth = Math.max(minWidth, cam.width * widthFactor);
  const cellWidth = (dialogWidth - margin * 2 - gap * (cols - 1)) / cols;
  const cardHeight = cellWidth * aspect;
  const cellHeight = cardHeight + extraCellHeight;
  const gridVisibleHeight = visibleRows * cellHeight + (visibleRows - 1) * gap;
  const dialogHeight = Math.max(minHeight, gridVisibleHeight + extraHeight);
  return {
    dialogWidth,
    dialogHeight,
    cellWidth,
    cellHeight,
    cardHeight,
    gridVisibleHeight,
    margin,
    gap,
    headerOffset,
    headerWrapPad,
    cols,
    visibleRows,
  };
}

export function computePromptDialogLayout(
  cam: Phaser.Cameras.Scene2D.Camera,
  config: CardDialogConfig,
  opts: { contentWidth: number; contentHeight: number; headerHeight: number },
): DialogLayout {
  const { margin, gap, widthFactor, minWidth, headerOffset, headerWrapPad } = config.dialog;
  const maxWidth = cam.width * widthFactor;
  const dialogWidth = Math.min(maxWidth, Math.max(minWidth, opts.contentWidth + margin * 2));
  const topToContent = headerOffset + opts.headerHeight / 2 + gap;
  const dialogHeight = topToContent + opts.contentHeight + margin;
  const cellWidth = Math.max(0, dialogWidth - margin * 2);
  const cardHeight = cellWidth * config.card.aspect;
  const cellHeight = cardHeight + config.card.extraCellHeight;
  return {
    dialogWidth,
    dialogHeight,
    cellWidth,
    cellHeight,
    cardHeight,
    gridVisibleHeight: cellHeight,
    margin,
    gap,
    headerOffset,
    headerWrapPad,
    cols: 1,
    visibleRows: 1,
  };
}

export function createDialogShell(
  scene: Phaser.Scene,
  config: CardDialogConfig,
  layout: DialogLayout,
  opts: {
    centerX: number;
    centerY: number;
    headerText: string;
    showOverlay?: boolean;
    closeOnBackdrop?: boolean;
    showCloseButton?: boolean;
    onClose?: () => void;
  },
) {
  const dialog = scene.add.container(opts.centerX, opts.centerY);
  dialog.setDepth(config.z.dialog);

  let overlay: Phaser.GameObjects.Rectangle | undefined;
  if (opts.showOverlay) {
    overlay = scene.add
      .rectangle(0, 0, scene.cameras.main.width, scene.cameras.main.height, 0x000000, config.overlayAlpha)
      .setInteractive({ useHandCursor: !!opts.closeOnBackdrop });
    if (opts.closeOnBackdrop) {
      overlay.on("pointerup", () => opts.onClose?.());
    }
    dialog.add(overlay);
  }

  const panel = scene.add.graphics({ x: 0, y: 0 });
  panel.fillStyle(0x3a3d42, 0.95);
  panel.fillRoundedRect(-layout.dialogWidth / 2, -layout.dialogHeight / 2, layout.dialogWidth, layout.dialogHeight, config.dialog.panelRadius);
  panel.lineStyle(2, 0x5b6068, 1);
  panel.strokeRoundedRect(-layout.dialogWidth / 2, -layout.dialogHeight / 2, layout.dialogWidth, layout.dialogHeight, config.dialog.panelRadius);
  dialog.add(panel);

  const header = scene.add.text(0, -layout.dialogHeight / 2 + layout.headerOffset, opts.headerText, {
    fontSize: "20px",
    fontFamily: "Arial",
    fontStyle: "bold",
    color: "#f5f6f7",
    align: "center",
    wordWrap: { width: layout.dialogWidth - layout.headerWrapPad },
  }).setOrigin(0.5);
  dialog.add(header);

  let closeButton: Phaser.GameObjects.Rectangle | undefined;
  let closeLabel: Phaser.GameObjects.Text | undefined;
  if (opts.showCloseButton) {
    const size = config.dialog.closeSize;
    const offset = config.dialog.closeOffset;
    closeButton = scene.add.rectangle(
      layout.dialogWidth / 2 - size - offset,
      -layout.dialogHeight / 2 + size + offset,
      size,
      size,
      0xffffff,
      0.12,
    );
    closeButton.setStrokeStyle(2, 0xffffff, 0.5);
    closeButton.setInteractive({ useHandCursor: true });
    closeButton.on("pointerup", () => opts.onClose?.());
    closeLabel = scene.add
      .text(closeButton.x, closeButton.y, "✕", { fontSize: "15px", fontFamily: "Arial", color: "#f5f6f7", align: "center" })
      .setOrigin(0.5);
    closeLabel.setInteractive({ useHandCursor: true });
    closeLabel.on("pointerup", () => opts.onClose?.());
    dialog.add(closeButton);
    dialog.add(closeLabel);
  }

  const content = scene.add.container(0, 0);
  dialog.add(content);

  return { dialog, overlay, header, content, closeButton, closeLabel };
}
