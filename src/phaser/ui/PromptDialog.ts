import Phaser from "phaser";
import { DEFAULT_CARD_DIALOG_CONFIG, computePromptDialogLayout, createDialogShell } from "./CardDialogLayout";

export type PromptDialogButton = {
  label: string;
  onClick: () => Promise<void> | void;
};

export type PromptDialogOptions = {
  headerText: string;
  promptText?: string;
  buttons: PromptDialogButton[];
  showOverlay?: boolean;
  closeOnBackdrop?: boolean;
  showCloseButton?: boolean;
  onClose?: () => void;
  headerGap?: number;
  headerFontSize?: number;
};

export function createPromptDialog(
  scene: Phaser.Scene,
  cfg = DEFAULT_CARD_DIALOG_CONFIG,
  opts: PromptDialogOptions,
) {
  const cam = scene.cameras.main;
  const promptText = opts.promptText ?? "";
  const hasPrompt = promptText.trim().length > 0;
  const hasButtons = opts.buttons.length > 0;
  const headerFontSize = opts.headerFontSize ?? cfg.dialog.headerFontSize ?? 20;
  const headerStyle = {
    fontSize: `${headerFontSize}px`,
    fontFamily: "Arial",
    fontStyle: "bold",
    color: "#f5f6f7",
    align: "center",
  };
  const promptStyle = {
    fontSize: "16px",
    fontFamily: "Arial",
    fontStyle: "bold",
    color: "#f5f6f7",
    align: "center",
    wordWrap: { width: Math.min(420, cam.width * 0.75) },
  };

  const hasHeader = opts.headerText.trim().length > 0;
  const tempHeader = hasHeader ? scene.add.text(-10000, -10000, opts.headerText, headerStyle).setOrigin(0.5) : undefined;
  const tempPrompt = hasPrompt ? scene.add.text(-10000, -10000, promptText, promptStyle).setOrigin(0.5) : undefined;
  const gap = opts.headerGap ?? 14;
  const buttonHeight = 46;
  const promptHeight = tempPrompt?.height ?? 0;
  const buttonContentHeight = promptHeight + (hasPrompt && hasButtons ? gap : 0) + (hasButtons ? buttonHeight : 0);
  const layout = computePromptDialogLayout(cam, cfg, {
    contentWidth: Math.max(tempPrompt?.width ?? 0, hasButtons ? 200 : 260),
    contentHeight: buttonContentHeight,
    headerHeight: tempHeader?.height ?? 0,
    headerGap: gap,
  });
  tempHeader?.destroy();
  tempPrompt?.destroy();

  const { dialog, content, header } = createDialogShell(scene, cfg, layout, {
    centerX: cam.centerX,
    centerY: cam.centerY,
    headerText: opts.headerText,
    headerFontSize: opts.headerFontSize,
    showOverlay: opts.showOverlay ?? false,
    closeOnBackdrop: opts.closeOnBackdrop ?? false,
    showCloseButton: opts.showCloseButton ?? false,
    onClose: opts.onClose,
  });

  const prompt = hasPrompt ? scene.add.text(0, 0, promptText, promptStyle).setOrigin(0.5) : undefined;
  const headerHeight = header?.height ?? 0;
  const headerBottom = -layout.dialogHeight / 2 + layout.headerOffset + headerHeight / 2;
  const contentTop = headerBottom + (layout.headerGap ?? gap);
  const promptY = hasPrompt ? contentTop + (prompt?.height ?? 0) / 2 : contentTop;
  if (prompt) prompt.setY(promptY);

  const dialogMargin = cfg.dialog.margin;
  const buttonGap = 24;
  const availableForButtons = Math.max(200, layout.dialogWidth - dialogMargin * 2);
  const count = opts.buttons.length;
  const buttonWidth =
    count > 1 ? Math.min(220, (availableForButtons - buttonGap * (count - 1)) / count) : Math.min(240, availableForButtons);
  const btnY = hasPrompt
    ? promptY + (prompt?.height ?? 0) / 2 + gap + buttonHeight / 2
    : contentTop + buttonHeight / 2;

  const buttons = opts.buttons.map((btn, index) => {
    const totalWidth = count * buttonWidth + buttonGap * (count - 1);
    const startX = -totalWidth / 2 + buttonWidth / 2;
    const x = startX + index * (buttonWidth + buttonGap);
    const rect = scene.add.rectangle(x, btnY, buttonWidth, buttonHeight, 0x2f3238, 1);
    rect.setStrokeStyle(2, 0x5b6068, 1);
    rect.setInteractive({ useHandCursor: true });
    rect.on("pointerup", async () => {
      await btn.onClick();
    });

    const txt = scene.add.text(x, btnY, btn.label, {
      fontSize: "15px",
      fontFamily: "Arial",
      fontStyle: "bold",
      color: "#f5f6f7",
      align: "center",
      wordWrap: { width: buttonWidth - 18 },
    });
    txt.setOrigin(0.5);
    return { rect, txt };
  });

  const nodes: Phaser.GameObjects.GameObject[] = [];
  if (prompt) nodes.push(prompt);
  buttons.forEach((btn) => nodes.push(btn.rect, btn.txt));
  content.add(nodes);
  return { dialog, buttons, layout };
}
