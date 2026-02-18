import Phaser from "phaser";
import { DEFAULT_CARD_DIALOG_CONFIG, computePromptDialogLayout, createDialogShell } from "./CardDialogLayout";

export type PromptDialogButton = {
  label: string;
  onClick: () => Promise<void> | void;
  enabled?: boolean;
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
  const count = opts.buttons.length;
  const hasLongButtonLabel = opts.buttons.some((btn) => (btn?.label ?? "").toString().length > 24);
  const useStackedButtons = count > 1 && (cam.width <= 900 || hasLongButtonLabel);
  const buttonHeight = useStackedButtons ? 52 : 46;
  const buttonGap = useStackedButtons ? 12 : 24;
  const buttonRows = hasButtons ? (useStackedButtons ? count : 1) : 0;
  const promptHeight = tempPrompt?.height ?? 0;
  const buttonsBlockHeight = buttonRows > 0 ? buttonRows * buttonHeight + Math.max(0, buttonRows - 1) * buttonGap : 0;
  const buttonContentHeight = promptHeight + (hasPrompt && hasButtons ? gap : 0) + buttonsBlockHeight;
  const minButtonContentWidth = useStackedButtons ? 260 : hasButtons ? 200 : 260;
  const layout = computePromptDialogLayout(cam, cfg, {
    contentWidth: Math.max(tempPrompt?.width ?? 0, minButtonContentWidth),
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
  const availableForButtons = Math.max(200, layout.dialogWidth - dialogMargin * 2);
  const inlineButtonWidth =
    count > 1 ? Math.min(220, (availableForButtons - buttonGap * (count - 1)) / count) : Math.min(240, availableForButtons);
  const stackedButtonWidth = Math.min(340, availableForButtons);
  const buttonWidth = useStackedButtons ? stackedButtonWidth : inlineButtonWidth;
  const btnY = hasPrompt
    ? promptY + (prompt?.height ?? 0) / 2 + gap + buttonHeight / 2
    : contentTop + buttonHeight / 2;

  const buttons = opts.buttons.map((btn, index) => {
    const totalWidth = count * buttonWidth + buttonGap * (count - 1);
    const startX = -totalWidth / 2 + buttonWidth / 2;
    const x = useStackedButtons ? 0 : startX + index * (buttonWidth + buttonGap);
    const y = useStackedButtons ? btnY + index * (buttonHeight + buttonGap) : btnY;
    const enabled = btn.enabled !== false;
    const fillColor = enabled ? 0x353a43 : 0x2f3238;
    const borderColor = enabled ? 0x8ea8ff : 0x5b6068;
    const rect = scene.add.rectangle(x, y, buttonWidth, buttonHeight, fillColor, enabled ? 1 : 0.45);
    rect.setStrokeStyle(2, borderColor, enabled ? 1 : 0.45);
    if (enabled) {
      rect.setInteractive({ useHandCursor: true });
      rect.on("pointerup", async () => {
        await btn.onClick();
      });
    }

    const txt = scene.add.text(x, y, btn.label, {
      fontSize: "15px",
      fontFamily: "Arial",
      fontStyle: "bold",
      color: enabled ? "#f5f6f7" : "#98a0aa",
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
