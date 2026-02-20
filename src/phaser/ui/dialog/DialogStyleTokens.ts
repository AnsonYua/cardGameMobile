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

export function createDialogActionButton(params: {
  scene: Phaser.Scene;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  enabled?: boolean;
  onClick?: () => Promise<void> | void;
}) {
  const enabled = params.enabled !== false;
  const fillColor = enabled ? 0x353a43 : 0x2f3238;
  const borderColor = enabled ? 0x8ea8ff : 0x5b6068;
  const textColor = enabled ? "#f5f6f7" : "#98a0aa";

  const rect = params.scene
    .add.rectangle(params.x, params.y, params.width, params.height, fillColor, enabled ? 1 : 0.45);
  rect.setStrokeStyle(2, borderColor, enabled ? 1 : 0.45);

  if (enabled && params.onClick) {
    rect.setInteractive({ useHandCursor: true });
    rect.on("pointerup", async () => {
      await params.onClick?.();
    });
  }

  const txt = params.scene
    .add.text(params.x, params.y, params.label, {
      ...DIALOG_TEXT.button,
      color: textColor,
      wordWrap: { width: params.width - 18 },
    })
    .setOrigin(0.5);

  return { rect, txt };
}
