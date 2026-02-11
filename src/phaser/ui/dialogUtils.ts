import type Phaser from "phaser";

const DEFAULT_HEADER_TOP_PAD = 8;
const DEFAULT_CLOSE_GUARD_PAD = 24;
const MIN_HEADER_WRAP_WIDTH = 120;

export const DIALOG_HEADER_TEXT_STYLE = {
  fontSize: "20px",
  fontFamily: "Arial",
  fontStyle: "bold",
  color: "#f5f6f7",
  align: "center",
} as const;

export function computeDialogHeaderWrapWidth(opts: {
  dialogWidth: number;
  headerWrapPad: number;
  showCloseButton: boolean;
  closeSize: number;
  closeOffset: number;
  closeGuardPad?: number;
}) {
  const closeGuardPad = opts.closeGuardPad ?? DEFAULT_CLOSE_GUARD_PAD;
  const closeReserved = opts.showCloseButton ? Math.max(0, opts.closeSize + opts.closeOffset + closeGuardPad) : 0;
  return opts.dialogWidth - opts.headerWrapPad - closeReserved;
}

export function buildDialogHeaderTextStyle(wrapWidth: number) {
  return {
    ...DIALOG_HEADER_TEXT_STYLE,
    wordWrap: { width: Math.max(MIN_HEADER_WRAP_WIDTH, wrapWidth) },
  } as const;
}

export function measureTextHeight(scene: Phaser.Scene, text: string, style: Phaser.Types.GameObjects.Text.TextStyle): number {
  const probe = scene.add.text(0, 0, text, style).setOrigin(0.5);
  const height = probe.getBounds().height;
  probe.destroy();
  return height;
}

export function computeDialogHeaderLayout(
  scene: Phaser.Scene,
  opts: {
    text: string;
    dialogWidth: number;
    headerWrapPad: number;
    headerOffset: number;
    showCloseButton: boolean;
    closeSize: number;
    closeOffset: number;
    headerTopPad?: number;
  },
) {
  const headerTopPad = opts.headerTopPad ?? DEFAULT_HEADER_TOP_PAD;
  const headerOffsetUsed = opts.headerOffset + headerTopPad;
  const wrapWidth = computeDialogHeaderWrapWidth({
    dialogWidth: opts.dialogWidth,
    headerWrapPad: opts.headerWrapPad,
    showCloseButton: opts.showCloseButton,
    closeSize: opts.closeSize,
    closeOffset: opts.closeOffset,
  });
  const style = buildDialogHeaderTextStyle(wrapWidth);
  const height = measureTextHeight(scene, opts.text, style);
  return { headerOffsetUsed, wrapWidth, height, style };
}

export function computeScrollMaskOverflowX(opts: { framePadding: number; frameExtraW: number; extra?: number }) {
  const extra = opts.extra ?? 0;
  return Math.ceil((opts.framePadding + opts.frameExtraW) / 2 + extra);
}

