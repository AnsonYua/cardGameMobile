import type Phaser from "phaser";
import { DEFAULT_CARD_DIALOG_CONFIG, computePromptDialogLayout, createDialogShell } from "./CardDialogLayout";
import { DialogTimerPresenter } from "./DialogTimerPresenter";
import { toBaseKey } from "./HandTypes";
import type { TurnTimerController } from "../controllers/TurnTimerController";
import {
  getTutorStep2EligibilityHint,
  type TutorTopDeckRevealCard,
} from "../controllers/choice/TutorTopDeckRevealContext";
import { DIALOG_TEXT, createDialogActionButton } from "./dialog/DialogStyleTokens";
import { resolveDialogHeaderGap } from "./dialog/DialogHeaderGap";
import { renderChoiceCardPlate } from "./choice/ChoiceCardPlateRenderer";
import {
  computeChoiceCardPlateGridLayout,
  forEachChoiceCardPlatePosition,
} from "./choice/ChoiceCardPlateGrid";

export type TutorTopDeckRevealDialogOptions = {
  headerText: string;
  promptText?: string;
  cards: TutorTopDeckRevealCard[];
  continueLabel?: string;
  showOverlay?: boolean;
  showTimer?: boolean;
  onContinue?: () => Promise<void> | void;
  onTimeout?: () => Promise<void> | void;
};

export class TutorTopDeckRevealDialog {
  private dialogTimer: DialogTimerPresenter;
  private dialog?: Phaser.GameObjects.Container;
  private automationState?: {
    headerText: string;
    promptText: string;
    continueLabel: string;
    cardIds: string[];
    onContinue?: () => Promise<void> | void;
  };

  constructor(private scene: Phaser.Scene, timerController?: TurnTimerController) {
    this.dialogTimer = new DialogTimerPresenter(scene, timerController);
  }

  isOpen() {
    return !!this.dialog;
  }

  hide() {
    this.destroy();
  }

  show(opts: TutorTopDeckRevealDialogOptions) {
    this.destroy();

    const cfg = {
      ...DEFAULT_CARD_DIALOG_CONFIG,
      z: { ...DEFAULT_CARD_DIALOG_CONFIG.z, dialog: 3080, overlay: 3079 },
    };
    const headerGap = resolveDialogHeaderGap(opts.showTimer ?? false, cfg.dialog.gap);

    const headerText = opts.headerText || "Top of Deck";
    const promptText = (opts.promptText ?? "Review the looked cards, then continue.").toString();
    const continueLabel = (opts.continueLabel ?? "Continue").toString();
    const cards = Array.isArray(opts.cards) ? opts.cards : [];

    this.automationState = {
      headerText,
      promptText,
      continueLabel,
      cardIds: cards.map((c) => (c?.cardId ?? "").toString()).filter(Boolean),
      onContinue: opts.onContinue,
    };

    const cam = this.scene.cameras.main;
    const maxContentWidth = Math.min(560, Math.max(300, cam.width * 0.78));
    const promptWidth = Math.min(maxContentWidth, cam.width * 0.72);

    const tempPrompt = this.scene
      .add.text(-10000, -10000, promptText, {
        ...DIALOG_TEXT.prompt,
        wordWrap: { width: promptWidth },
      })
      .setOrigin(0.5);
    const promptHeight = tempPrompt.height;
    const promptMeasuredWidth = tempPrompt.width;
    tempPrompt.destroy();

    const gap = 12;
    const buttonHeight = 48;
    const sectionGap = 14;
    const plateGrid = computeChoiceCardPlateGridLayout({
      itemCount: cards.length,
      maxContentWidth,
      cardAspect: cfg.card.aspect,
      colsMax: 3,
      gap,
      minCellWidth: 96,
      maxCellWidth: 170,
      extraCellHeight: 36,
    });
    const cardGridWidth = plateGrid.gridWidth;
    const cardGridHeight = plateGrid.gridHeight;
    const buttonWidth = Math.min(320, maxContentWidth);

    const contentWidth = Math.max(280, promptMeasuredWidth, cardGridWidth, buttonWidth);
    const contentHeight = promptHeight + sectionGap + cardGridHeight + sectionGap + buttonHeight;

    const tempHeader = this.scene
      .add.text(-10000, -10000, headerText, {
        fontSize: `${cfg.dialog.headerFontSize ?? 20}px`,
        ...DIALOG_TEXT.header,
        wordWrap: { width: Math.min(520, cam.width * 0.75) },
      })
      .setOrigin(0.5);

    const layout = computePromptDialogLayout(cam, cfg, {
      contentWidth,
      contentHeight,
      headerHeight: tempHeader.height,
      headerGap,
    });
    tempHeader.destroy();

    const shell = createDialogShell(this.scene, cfg, layout, {
      centerX: cam.centerX,
      centerY: cam.centerY,
      headerText,
      showOverlay: opts.showOverlay ?? true,
      closeOnBackdrop: false,
      showCloseButton: false,
    });
    this.dialog = shell.dialog;

    let cursorY =
      -layout.dialogHeight / 2 +
      layout.headerOffset +
      (layout.headerHeight ?? 0) / 2 +
      (layout.headerGap ?? headerGap);

    const promptNode = this.scene
      .add.text(0, cursorY + promptHeight / 2, promptText, {
        ...DIALOG_TEXT.prompt,
        wordWrap: { width: promptWidth },
      })
      .setOrigin(0.5);
    shell.content.add(promptNode);
    cursorY += promptHeight + sectionGap;

    forEachChoiceCardPlatePosition(
      cards.length,
      plateGrid,
      {
        startX: -cardGridWidth / 2 + plateGrid.cellWidth / 2,
        startY: cursorY + plateGrid.cellHeight / 2,
      },
      ({ index, x, y }) => {
        const card = cards[index];
      renderChoiceCardPlate({
        scene: this.scene,
        container: shell.content,
        x,
        y,
        cardWidth: plateGrid.cellWidth,
        cardHeight: plateGrid.imageHeight,
        state: "read_only",
        enabled: true,
        hintText: getTutorStep2EligibilityHint(card),
        interactive: false,
        card: {
          cardId: card.cardId,
          label: card.name || card.cardId,
          textureKey: toBaseKey(card.cardId) || card.cardId,
        },
      });
      },
    );

    cursorY += cardGridHeight + sectionGap;

    const button = createDialogActionButton({
      scene: this.scene,
      x: 0,
      y: cursorY + buttonHeight / 2,
      width: buttonWidth,
      height: buttonHeight,
      label: continueLabel,
      enabled: true,
      onClick: async () => {
        await opts.onContinue?.();
      },
    });

    shell.content.add([button.rect, button.txt]);

    if (opts.showTimer) {
      this.dialogTimer.attach(shell.dialog, layout, async () => {
        await opts.onTimeout?.();
      });
    }
  }

  getAutomationState() {
    if (!this.dialog || !this.automationState) return null;
    return {
      open: true,
      headerText: this.automationState.headerText,
      promptText: this.automationState.promptText,
      continueLabel: this.automationState.continueLabel,
      cardIds: this.automationState.cardIds,
    };
  }

  async continue(): Promise<boolean> {
    if (!this.dialog || !this.automationState?.onContinue) return false;
    await Promise.resolve(this.automationState.onContinue());
    return true;
  }

  private destroy() {
    this.dialogTimer.stop();
    if (this.dialog) {
      this.dialog.destroy();
      this.dialog = undefined;
    }
    this.automationState = undefined;
  }
}
