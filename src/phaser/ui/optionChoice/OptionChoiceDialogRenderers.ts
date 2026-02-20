import type Phaser from "phaser";
import {
  computePromptDialogLayout,
  createDialogShell,
  type CardDialogConfig,
} from "../CardDialogLayout";
import { createPromptDialog } from "../PromptDialog";
import { DialogTimerPresenter } from "../DialogTimerPresenter";
import type { NormalizedOptionChoice } from "./OptionChoiceDialogModel";
import { DIALOG_TEXT, createDialogActionButton } from "../dialog/DialogStyleTokens";
import { resolveDialogHeaderGap } from "../dialog/DialogHeaderGap";
import { renderChoiceCardPlate } from "../choice/ChoiceCardPlateRenderer";
import {
  computeChoiceCardPlateGridLayout,
  forEachChoiceCardPlatePosition,
} from "../choice/ChoiceCardPlateGrid";

const PROMPT_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  ...DIALOG_TEXT.prompt,
};

export function renderOptionChoiceTextDialog(params: {
  scene: Phaser.Scene;
  cfg: CardDialogConfig;
  dialogTimer: DialogTimerPresenter;
  headerText: string;
  promptText: string;
  showOverlay: boolean;
  showTimer: boolean;
  onTimeout?: () => Promise<void> | void;
  onSelect?: (index: number) => Promise<void> | void;
  options: NormalizedOptionChoice[];
}): Phaser.GameObjects.Container {
  const headerGap = resolveDialogHeaderGap(params.showTimer, params.cfg.dialog.gap);
  const buttons = params.options.map((option) => ({
    label: option.label,
    enabled: option.enabled,
    onClick: async () => {
      if (!option.enabled) return;
      await params.onSelect?.(option.index);
    },
  }));

  const prompt = createPromptDialog(params.scene, params.cfg, {
    headerText: params.headerText,
    promptText: params.promptText,
    buttons,
    showOverlay: params.showOverlay,
    closeOnBackdrop: false,
    showCloseButton: false,
    headerGap,
  });

  if (params.showTimer) {
    params.dialogTimer.attach(prompt.dialog, prompt.layout, async () => {
      await params.onTimeout?.();
    });
  }

  return prompt.dialog;
}

export function renderOptionChoiceHybridDialog(params: {
  scene: Phaser.Scene;
  cfg: CardDialogConfig;
  dialogTimer: DialogTimerPresenter;
  headerText: string;
  promptText: string;
  showOverlay: boolean;
  showTimer: boolean;
  onTimeout?: () => Promise<void> | void;
  onSelect?: (index: number) => Promise<void> | void;
  cardChoices: NormalizedOptionChoice[];
  textChoices: NormalizedOptionChoice[];
  resolveTextureKey: (cardId?: string) => string | undefined;
}): Phaser.GameObjects.Container {
  const cam = params.scene.cameras.main;
  const gap = 12;
  const buttonHeight = 48;
  const buttonGap = 10;
  const sectionGap = 14;
  const maxContentWidth = Math.min(540, Math.max(280, cam.width * 0.74));
  const headerGap = resolveDialogHeaderGap(params.showTimer, params.cfg.dialog.gap);

  const promptWidth = Math.min(maxContentWidth, cam.width * 0.72);
  const promptText = params.promptText.trim();
  const tempPrompt = promptText
    ? params.scene
        .add.text(-10000, -10000, promptText, {
          ...PROMPT_STYLE,
          wordWrap: { width: promptWidth },
        })
        .setOrigin(0.5)
    : undefined;
  const promptHeight = tempPrompt?.height ?? 0;
  const promptMeasuredWidth = tempPrompt?.width ?? 0;
  tempPrompt?.destroy();

  const plateGrid = computeChoiceCardPlateGridLayout({
    itemCount: params.cardChoices.length,
    maxContentWidth,
    cardAspect: params.cfg.card.aspect,
    colsMax: 3,
    gap,
    minCellWidth: 96,
    maxCellWidth: 170,
    extraCellHeight: 36,
  });
  const cardGridWidth = params.cardChoices.length > 0 ? plateGrid.gridWidth : 0;
  const cardGridHeight = params.cardChoices.length > 0 ? plateGrid.gridHeight : 0;

  const buttonWidth = Math.min(340, maxContentWidth);
  const buttonsHeight =
    params.textChoices.length > 0
      ? params.textChoices.length * buttonHeight + Math.max(0, params.textChoices.length - 1) * buttonGap
      : 0;

  const contentWidth = Math.max(
    260,
    promptMeasuredWidth,
    params.cardChoices.length > 0 ? cardGridWidth : 0,
    params.textChoices.length > 0 ? buttonWidth : 0,
  );

  const hasPrompt = promptHeight > 0;
  const hasCards = params.cardChoices.length > 0;
  const hasTextButtons = params.textChoices.length > 0;

  let contentHeight = 0;
  if (hasPrompt) contentHeight += promptHeight;
  if (hasCards) {
    if (contentHeight > 0) contentHeight += sectionGap;
    contentHeight += cardGridHeight;
  }
  if (hasTextButtons) {
    if (contentHeight > 0) contentHeight += sectionGap;
    contentHeight += buttonsHeight;
  }
  if (contentHeight <= 0) contentHeight = 24;

  const tempHeader = params.scene.add
    .text(-10000, -10000, params.headerText, {
      fontSize: `${params.cfg.dialog.headerFontSize ?? 20}px`,
      fontFamily: "Arial",
      fontStyle: "bold",
      color: "#f5f6f7",
      align: "center",
      wordWrap: { width: Math.min(520, cam.width * 0.75) },
    })
    .setOrigin(0.5);

  const layout = computePromptDialogLayout(cam, params.cfg, {
    contentWidth,
    contentHeight,
    headerHeight: tempHeader.height,
    headerGap,
  });
  tempHeader.destroy();

  const shell = createDialogShell(params.scene, params.cfg, layout, {
    centerX: cam.centerX,
    centerY: cam.centerY,
    headerText: params.headerText,
    showOverlay: params.showOverlay,
    closeOnBackdrop: false,
    showCloseButton: false,
  });

  let cursorY =
    -layout.dialogHeight / 2 +
    layout.headerOffset +
    (layout.headerHeight ?? 0) / 2 +
    (layout.headerGap ?? headerGap);

  if (hasPrompt) {
    const promptNode = params.scene
      .add.text(0, cursorY + promptHeight / 2, promptText, {
        ...PROMPT_STYLE,
        wordWrap: { width: promptWidth },
      })
      .setOrigin(0.5);
    shell.content.add(promptNode);
    cursorY += promptHeight;
    if (hasCards || hasTextButtons) cursorY += sectionGap;
  }

  if (hasCards) {
    forEachChoiceCardPlatePosition(
      params.cardChoices.length,
      plateGrid,
      {
        startX: -cardGridWidth / 2 + plateGrid.cellWidth / 2,
        startY: cursorY + plateGrid.cellHeight / 2,
      },
      ({ index, x, y }) => {
        const choice = params.cardChoices[index];
      renderChoiceCardPlate({
        scene: params.scene,
        container: shell.content,
        x,
        y,
        cardWidth: plateGrid.cellWidth,
        cardHeight: plateGrid.imageHeight,
        state: choice.interactionState,
        enabled: choice.enabled,
        card: {
          cardId: choice.cardId,
          label: choice.label,
          textureKey: params.resolveTextureKey(choice.cardId) ?? "deckBack",
        },
        onSelect: async () => {
          await params.onSelect?.(choice.index);
        },
      });
      },
    );

    cursorY += cardGridHeight;
    if (hasTextButtons) cursorY += sectionGap;
  }

  if (hasTextButtons) {
    for (let i = 0; i < params.textChoices.length; i += 1) {
      const option = params.textChoices[i];
      const y = cursorY + buttonHeight / 2 + i * (buttonHeight + buttonGap);
      const button = createDialogActionButton({
        scene: params.scene,
        x: 0,
        y,
        width: buttonWidth,
        height: buttonHeight,
        label: option.label,
        enabled: option.enabled,
        onClick: async () => {
          await params.onSelect?.(option.index);
        },
      });
      shell.content.add([button.rect, button.txt]);
    }
  }

  if (params.showTimer) {
    params.dialogTimer.attach(shell.dialog, layout, async () => {
      await params.onTimeout?.();
    });
  }

  return shell.dialog;
}
