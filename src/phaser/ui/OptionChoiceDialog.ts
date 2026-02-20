import type Phaser from "phaser";
import { DEFAULT_CARD_DIALOG_CONFIG, type CardDialogConfig } from "./CardDialogLayout";
import { toBaseKey } from "./HandTypes";
import { DialogTimerPresenter } from "./DialogTimerPresenter";
import type { TurnTimerController } from "../controllers/TurnTimerController";
import { resolveOptionChoiceLayout, type OptionChoiceLayoutHint } from "../controllers/choice/OptionChoiceLayoutResolver";
import {
  normalizeOptionChoices,
  type OptionChoiceDialogChoice,
} from "./optionChoice/OptionChoiceDialogModel";
import {
  renderOptionChoiceHybridDialog,
  renderOptionChoiceTextDialog,
} from "./optionChoice/OptionChoiceDialogRenderers";

export type { OptionChoiceDialogChoice };

export type OptionChoiceDialogOptions = {
  headerText?: string;
  promptText?: string;
  layoutHint?: OptionChoiceLayoutHint;
  choices: OptionChoiceDialogChoice[];
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
