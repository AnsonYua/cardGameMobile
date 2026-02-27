import type Phaser from "phaser";

export const DIALOG_TEXT = {
  header: {
    fontFamily: "Arial",
    fontStyle: "bold",
    color: "#f5f6f7",
    align: "center",
  } as const,
  prompt: {
    fontSize: "16px",
    fontFamily: "Arial",
    fontStyle: "bold",
    color: "#f5f6f7",
    align: "center",
  } as const,
  button: {
    fontSize: "15px",
    fontFamily: "Arial",
    fontStyle: "bold",
    align: "center",
  } as const,
};

type DialogActionButtonVariant = "default" | "primaryTopBottom" | "secondaryTopBottom";

export function resolveDialogActionButtonPalette(enabled: boolean, variant: DialogActionButtonVariant) {
  if (!enabled) {
    return { fillColor: 0x2f3238, borderColor: 0x5b6068, textColor: "#98a0aa", alpha: 0.45 };
  }
  if (variant === "primaryTopBottom") {
    return { fillColor: 0x273b6d, borderColor: 0x7ea7ff, textColor: "#f7fbff", alpha: 1 };
  }
  if (variant === "secondaryTopBottom") {
    return { fillColor: 0x38414f, borderColor: 0x96acdc, textColor: "#e7edf8", alpha: 1 };
  }
  return { fillColor: 0x353a43, borderColor: 0x8ea8ff, textColor: "#f5f6f7", alpha: 1 };
}

export function createDialogActionButton(params: {
  scene: Phaser.Scene;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  enabled?: boolean;
  variant?: DialogActionButtonVariant;
  onClick?: () => Promise<void> | void;
}) {
  const enabled = params.enabled !== false;
  const variant = params.variant ?? "default";
  const palette = resolveDialogActionButtonPalette(enabled, variant);

  const rect = params.scene
    .add.rectangle(params.x, params.y, params.width, params.height, palette.fillColor, palette.alpha);
  rect.setStrokeStyle(2, palette.borderColor, palette.alpha);

  if (enabled && params.onClick) {
    rect.setInteractive({ useHandCursor: true });
    rect.on("pointerup", async () => {
      await params.onClick?.();
    });
  }

  const wrappedLabel = params.label.replace(/([_:/()\\-])/g, "$1\u200b");
  const txt = params.scene
    .add.text(params.x, params.y, wrappedLabel, {
      ...DIALOG_TEXT.button,
      color: palette.textColor,
      wordWrap: { width: params.width - 18, useAdvancedWrap: true },
    })
    .setOrigin(0.5);

  return { rect, txt };
}
