import type Phaser from "phaser";
import {
  computePromptDialogLayout,
  createDialogShell,
  type CardDialogConfig,
} from "../CardDialogLayout";
import { createPromptDialog } from "../PromptDialog";
import { DialogTimerPresenter } from "../DialogTimerPresenter";
import { TrashCardGridRenderer } from "../TrashCardGridRenderer";
import type { NormalizedOptionChoice } from "./OptionChoiceDialogModel";

type RenderCard = {
  __choiceIndex: number;
  __enabled: boolean;
  cardId?: string;
  cardType?: string;
  cardData?: { id?: string; name?: string; cardType?: string };
  textureKey?: string;
};

const PROMPT_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontSize: "16px",
  fontFamily: "Arial",
  fontStyle: "bold",
  color: "#f5f6f7",
  align: "center",
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
  gridRenderer: TrashCardGridRenderer;
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

  const cardCols = Math.max(1, Math.min(3, params.cardChoices.length || 1));
  const baseCardCell = Math.floor((maxContentWidth - gap * (cardCols - 1)) / cardCols);
  const cardCellWidth = Math.max(96, Math.min(170, baseCardCell));
  const cardCellHeight = cardCellWidth * params.cfg.card.aspect + params.cfg.card.extraCellHeight;
  const cardRows = params.cardChoices.length > 0 ? Math.ceil(params.cardChoices.length / cardCols) : 0;
  const cardGridWidth =
    params.cardChoices.length > 0 ? cardCols * cardCellWidth + (cardCols - 1) * gap : 0;
  const cardGridHeight =
    params.cardChoices.length > 0 ? cardRows * cardCellHeight + Math.max(0, cardRows - 1) * gap : 0;

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
    headerGap: params.cfg.dialog.gap,
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
    (layout.headerGap ?? params.cfg.dialog.gap);

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
    const cards: RenderCard[] = params.cardChoices.map((choice) => ({
      __choiceIndex: choice.index,
      __enabled: choice.enabled,
      cardId: choice.cardId,
      cardType: "option",
      cardData: {
        id: choice.cardId,
        name: choice.label,
        cardType: "option",
      },
      textureKey: params.resolveTextureKey(choice.cardId) ?? "deckBack",
    }));

    params.gridRenderer.render({
      container: shell.content,
      cards,
      cols: cardCols,
      gap,
      startX: -cardGridWidth / 2 + cardCellWidth / 2,
      startY: cursorY + cardCellHeight / 2,
      cellWidth: cardCellWidth,
      cellHeight: cardCellHeight,
      cardConfig: {
        ...params.cfg.card,
        frameExtra: { ...params.cfg.card.frameExtra, h: 0 },
        extraCellHeight: 0,
      },
      badgeConfig: params.cfg.badge,
      typeOverrides: params.cfg.cardTypeOverrides,
      isCardInteractive: (card: RenderCard) => card.__enabled,
      onPointerUp: async (card: RenderCard) => {
        if (!card.__enabled) return;
        await params.onSelect?.(card.__choiceIndex);
      },
    });

    cursorY += cardGridHeight;
    if (hasTextButtons) cursorY += sectionGap;
  }

  if (hasTextButtons) {
    for (let i = 0; i < params.textChoices.length; i += 1) {
      const option = params.textChoices[i];
      const y = cursorY + buttonHeight / 2 + i * (buttonHeight + buttonGap);
      const fillColor = option.enabled ? 0x353a43 : 0x2f3238;
      const borderColor = option.enabled ? 0x8ea8ff : 0x5b6068;
      const rect = params.scene.add.rectangle(0, y, buttonWidth, buttonHeight, fillColor, option.enabled ? 1 : 0.45);
      rect.setStrokeStyle(2, borderColor, option.enabled ? 1 : 0.45);
      if (option.enabled) {
        rect.setInteractive({ useHandCursor: true });
        rect.on("pointerup", async () => {
          await params.onSelect?.(option.index);
        });
      }

      const text = params.scene
        .add.text(0, y, option.label, {
          fontSize: "15px",
          fontFamily: "Arial",
          fontStyle: "bold",
          color: option.enabled ? "#f5f6f7" : "#98a0aa",
          align: "center",
          wordWrap: { width: buttonWidth - 18 },
        })
        .setOrigin(0.5);

      shell.content.add([rect, text]);
    }
  }

  if (params.showTimer) {
    params.dialogTimer.attach(shell.dialog, layout, async () => {
      await params.onTimeout?.();
    });
  }

  return shell.dialog;
}
