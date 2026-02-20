import type Phaser from "phaser";
import { DEFAULT_CARD_DIALOG_CONFIG, computePromptDialogLayout, createDialogShell } from "./CardDialogLayout";
import { DialogTimerPresenter } from "./DialogTimerPresenter";
import { TrashCardGridRenderer } from "./TrashCardGridRenderer";
import { toBaseKey } from "./HandTypes";
import type { TurnTimerController } from "../controllers/TurnTimerController";
import type { TutorTopDeckRevealCard } from "../controllers/choice/TutorTopDeckRevealContext";

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
  private gridRenderer: TrashCardGridRenderer;
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
    this.gridRenderer = new TrashCardGridRenderer(scene);
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
        fontSize: "16px",
        fontFamily: "Arial",
        fontStyle: "bold",
        color: "#f5f6f7",
        align: "center",
        wordWrap: { width: promptWidth },
      })
      .setOrigin(0.5);
    const promptHeight = tempPrompt.height;
    const promptMeasuredWidth = tempPrompt.width;
    tempPrompt.destroy();

    const cols = Math.max(1, Math.min(3, cards.length || 1));
    const gap = 12;
    const buttonHeight = 48;
    const sectionGap = 14;
    const baseCardCell = Math.floor((maxContentWidth - gap * (cols - 1)) / cols);
    const cardCellWidth = Math.max(96, Math.min(170, baseCardCell));
    const cardCellHeight = cardCellWidth * cfg.card.aspect + cfg.card.extraCellHeight;
    const rows = cards.length > 0 ? Math.ceil(cards.length / cols) : 1;
    const cardGridWidth = cols * cardCellWidth + (cols - 1) * gap;
    const cardGridHeight = rows * cardCellHeight + Math.max(0, rows - 1) * gap;
    const buttonWidth = Math.min(320, maxContentWidth);

    const contentWidth = Math.max(280, promptMeasuredWidth, cardGridWidth, buttonWidth);
    const contentHeight = promptHeight + sectionGap + cardGridHeight + sectionGap + buttonHeight;

    const tempHeader = this.scene
      .add.text(-10000, -10000, headerText, {
        fontSize: `${cfg.dialog.headerFontSize ?? 20}px`,
        fontFamily: "Arial",
        fontStyle: "bold",
        color: "#f5f6f7",
        align: "center",
        wordWrap: { width: Math.min(520, cam.width * 0.75) },
      })
      .setOrigin(0.5);

    const layout = computePromptDialogLayout(cam, cfg, {
      contentWidth,
      contentHeight,
      headerHeight: tempHeader.height,
      headerGap: cfg.dialog.gap,
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
      (layout.headerGap ?? cfg.dialog.gap);

    const promptNode = this.scene
      .add.text(0, cursorY + promptHeight / 2, promptText, {
        fontSize: "16px",
        fontFamily: "Arial",
        fontStyle: "bold",
        color: "#f5f6f7",
        align: "center",
        wordWrap: { width: promptWidth },
      })
      .setOrigin(0.5);
    shell.content.add(promptNode);
    cursorY += promptHeight + sectionGap;

    const renderCards = cards.map((card, idx) => ({
      __cardIdx: idx,
      cardId: card.cardId,
      cardType: "option",
      cardData: {
        id: card.cardId,
        name: card.name || card.cardId,
        cardType: "option",
      },
      textureKey: toBaseKey(card.cardId) || "deckBack",
    }));

    this.gridRenderer.render({
      container: shell.content,
      cards: renderCards,
      cols,
      gap,
      startX: -cardGridWidth / 2 + cardCellWidth / 2,
      startY: cursorY + cardCellHeight / 2,
      cellWidth: cardCellWidth,
      cellHeight: cardCellHeight,
      cardConfig: {
        ...cfg.card,
        frameExtra: { ...cfg.card.frameExtra, h: 0 },
        extraCellHeight: 0,
      },
      badgeConfig: cfg.badge,
      typeOverrides: cfg.cardTypeOverrides,
      isCardInteractive: () => false,
    });

    cursorY += cardGridHeight + sectionGap;

    const button = this.scene.add.rectangle(0, cursorY + buttonHeight / 2, buttonWidth, buttonHeight, 0x353a43, 1);
    button.setStrokeStyle(2, 0x8ea8ff, 1);
    button.setInteractive({ useHandCursor: true });
    button.on("pointerup", async () => {
      await opts.onContinue?.();
    });

    const buttonText = this.scene
      .add.text(0, cursorY + buttonHeight / 2, continueLabel, {
        fontSize: "15px",
        fontFamily: "Arial",
        fontStyle: "bold",
        color: "#f5f6f7",
        align: "center",
      })
      .setOrigin(0.5);

    shell.content.add([button, buttonText]);

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
