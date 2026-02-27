import type Phaser from "phaser";
import { DEFAULT_CARD_DIALOG_CONFIG, type CardDialogConfig } from "./CardDialogLayout";
import { toBaseKey } from "./HandTypes";
import { DialogTimerPresenter } from "./DialogTimerPresenter";
import type { TurnTimerController } from "../controllers/TurnTimerController";
import { resolveOptionChoiceLayout, type OptionChoiceLayoutHint } from "../controllers/choice/OptionChoiceLayoutResolver";
import { detectTopBottomDecision } from "../controllers/choice/TopBottomChoiceDetector";
import {
  normalizeOptionChoices,
  type OptionChoiceDialogChoice,
} from "./optionChoice/OptionChoiceDialogModel";
import {
  renderOptionChoiceHybridDialog,
  renderOptionChoiceTextDialog,
  renderTopBottomCardDecisionDialog,
} from "./optionChoice/OptionChoiceDialogRenderers";

export type { OptionChoiceDialogChoice };

export type OptionChoiceDialogOptions = {
  headerText?: string;
  promptText?: string;
  layoutHint?: OptionChoiceLayoutHint;
  choices: OptionChoiceDialogChoice[];
  optionActions?: Array<{ index: number; action?: string }>;
  showChoices?: boolean;
  showOverlay?: boolean;
  showTimer?: boolean;
  onSelect?: (index: number) => Promise<void> | void;
  onTimeout?: () => Promise<void> | void;
};

export class OptionChoiceDialog {
  private dialogTimer: DialogTimerPresenter;
  private dialog?: Phaser.GameObjects.Container;
  private automationState?: {
    headerText: string;
    promptText: string;
    choices: OptionChoiceDialogChoice[];
    isOwnerView: boolean;
    onSelect?: (index: number) => Promise<void> | void;
  };

  private cfg: CardDialogConfig = {
    ...DEFAULT_CARD_DIALOG_CONFIG,
    z: { ...DEFAULT_CARD_DIALOG_CONFIG.z, dialog: 3100, overlay: 3099 },
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

  show(opts: OptionChoiceDialogOptions) {
    this.destroy();

    const choices = normalizeOptionChoices(opts.choices);
    const layout = resolveOptionChoiceLayout(choices, opts.layoutHint);
    const headerText = opts.headerText ?? "Choose Option";
    const promptText = (opts.promptText ?? "").toString();
    const showChoices = opts.showChoices ?? true;

    this.automationState = {
      headerText,
      promptText,
      choices: choices.map((choice) => ({
        index: choice.index,
        mode: choice.mode,
        cardId: choice.cardId,
        label: choice.label,
        enabled: choice.enabled,
      })),
      isOwnerView: showChoices,
      onSelect: opts.onSelect,
    };

    if (!showChoices) {
      this.dialog = renderOptionChoiceTextDialog({
        scene: this.scene,
        cfg: this.cfg,
        dialogTimer: this.dialogTimer,
        headerText,
        promptText: "Opponent is deciding...",
        showOverlay: opts.showOverlay ?? true,
        showTimer: opts.showTimer ?? false,
        onTimeout: opts.onTimeout,
        options: [],
      });
      return;
    }

    if (layout === "text") {
      this.dialog = renderOptionChoiceTextDialog({
        scene: this.scene,
        cfg: this.cfg,
        dialogTimer: this.dialogTimer,
        headerText,
        promptText,
        showOverlay: opts.showOverlay ?? true,
        showTimer: opts.showTimer ?? false,
        onTimeout: opts.onTimeout,
        onSelect: opts.onSelect,
        options: choices,
      });
      return;
    }

    const actionByIndex = new Map(
      (opts.optionActions ?? []).map((entry) => [Number(entry.index), (entry.action ?? "").toString()]),
    );
    const topBottom = detectTopBottomDecision(
      choices.map((choice) => ({
        index: choice.index,
        label: choice.label,
        enabled: choice.enabled,
        mode: choice.mode,
        cardId: choice.cardId,
        interactionState: choice.interactionState,
        action: actionByIndex.get(choice.index),
      })),
    );
    if (topBottom) {
      this.dialog = renderTopBottomCardDecisionDialog({
        scene: this.scene,
        cfg: this.cfg,
        dialogTimer: this.dialogTimer,
        headerText,
        promptText,
        showOverlay: opts.showOverlay ?? true,
        showTimer: opts.showTimer ?? false,
        onTimeout: opts.onTimeout,
        onSelect: opts.onSelect,
        decision: topBottom,
        resolveTextureKey: (cardId) => this.resolveTextureKey(cardId),
      });
      return;
    }

    // Tutor-style single-card decision: show card preview + 2 explicit buttons
    // instead of "tap card + bottom button".
    const takeBottom = detectTakeBottomDecision(
      choices.map((choice) => ({
        index: choice.index,
        label: choice.label,
        enabled: choice.enabled,
        cardId: choice.cardId,
        interactionState: choice.interactionState,
        action: actionByIndex.get(choice.index),
      })),
    );
    if (takeBottom) {
      this.dialog = renderTopBottomCardDecisionDialog({
        scene: this.scene,
        cfg: this.cfg,
        dialogTimer: this.dialogTimer,
        headerText,
        promptText,
        showOverlay: opts.showOverlay ?? true,
        showTimer: opts.showTimer ?? false,
        onTimeout: opts.onTimeout,
        onSelect: opts.onSelect,
        decision: {
          topIndex: takeBottom.takeIndex,
          bottomIndex: takeBottom.bottomIndex,
          topLabel: "Add to hand",
          bottomLabel: takeBottom.bottomLabel,
          topEnabled: takeBottom.takeEnabled,
          bottomEnabled: takeBottom.bottomEnabled,
          cardChoice: {
            index: takeBottom.cardChoice.index,
            cardId: takeBottom.cardChoice.cardId,
            label: takeBottom.cardChoice.label,
            enabled: true,
            interactionState: "read_only",
          },
        },
        resolveTextureKey: (cardId) => this.resolveTextureKey(cardId),
      });
      return;
    }

    this.dialog = renderOptionChoiceHybridDialog({
      scene: this.scene,
      cfg: this.cfg,
      dialogTimer: this.dialogTimer,
      headerText,
      promptText,
      showOverlay: opts.showOverlay ?? true,
      showTimer: opts.showTimer ?? false,
      onTimeout: opts.onTimeout,
      onSelect: opts.onSelect,
      cardChoices: choices.filter((choice) => choice.mode === "card" && !!choice.cardId),
      textChoices: layout === "hybrid" ? choices.filter((choice) => choice.mode === "text" || !choice.cardId) : [],
      resolveTextureKey: (cardId) => this.resolveTextureKey(cardId),
    });
  }

  getAutomationState() {
    if (!this.dialog || !this.automationState) return null;
    return {
      open: true,
      headerText: this.automationState.headerText,
      promptText: this.automationState.promptText,
      choices: this.automationState.choices.map((choice) => ({
        index: choice.index,
        mode: choice.mode,
        cardId: choice.cardId,
        label: choice.label,
        enabled: choice.enabled !== false,
      })),
      isOwnerView: this.automationState.isOwnerView,
    };
  }

  async choose(index: number): Promise<boolean> {
    if (!this.dialog || !this.automationState) return false;
    const target = this.automationState.choices.find((choice) => choice.index === index);
    if (!target || target.enabled === false || !this.automationState.onSelect) return false;
    await Promise.resolve(this.automationState.onSelect(index));
    return true;
  }

  private resolveTextureKey(cardId?: string) {
    if (!cardId) return undefined;
    const base = toBaseKey(cardId);
    return base || undefined;
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

function detectTakeBottomDecision(
  choices: Array<{
    index: number;
    label: string;
    enabled: boolean;
    cardId?: string;
    interactionState: "read_only" | "selectable";
    action?: string;
  }>,
):
  | {
      takeIndex: number;
      bottomIndex: number;
      bottomLabel: string;
      takeEnabled: boolean;
      bottomEnabled: boolean;
      cardChoice: { index: number; cardId: string; label: string };
    }
  | undefined {
  if (!Array.isArray(choices) || choices.length !== 2) return undefined;
  const take = choices.find((choice) => (choice.action ?? "").toString().toUpperCase() === "TAKE");
  const bottom = choices.find((choice) => (choice.action ?? "").toString().toUpperCase() === "BOTTOM");
  if (!take || !bottom) return undefined;
  const cardChoice = choices.find((choice) => !!choice.cardId);
  if (!cardChoice?.cardId) return undefined;
  return {
    takeIndex: take.index,
    bottomIndex: bottom.index,
    bottomLabel: bottom.label || "Bottom",
    takeEnabled: take.enabled !== false,
    bottomEnabled: bottom.enabled !== false,
    cardChoice: {
      index: cardChoice.index,
      cardId: cardChoice.cardId,
      label: cardChoice.label || "Card",
    },
  };
}
