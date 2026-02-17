import Phaser from "phaser";
import { DEFAULT_CARD_DIALOG_CONFIG } from "./CardDialogLayout";
import { CardRowChoiceDialog } from "./CardRowChoiceDialog";
import { toBaseKey } from "./HandTypes";
import type { TurnTimerController } from "../controllers/TurnTimerController";

export type TokenChoiceDialogChoice = {
  index: number;
  cardId?: string;
  enabled?: boolean;
};

export type TokenChoiceDialogOptions = {
  headerText?: string;
  choices: TokenChoiceDialogChoice[];
  showChoices?: boolean;
  showOverlay?: boolean;
  showTimer?: boolean;
  onSelect?: (index: number) => Promise<void> | void;
  onTimeout?: () => Promise<void> | void;
};

type RenderCard = {
  __choiceIndex: number;
  __enabled: boolean;
  cardId?: string;
  cardType?: string;
  cardData?: { id?: string; name?: string; cardType?: string };
  textureKey?: string;
};

export class TokenChoiceDialog {
  private dialog: CardRowChoiceDialog<RenderCard>;
  private automationState?: {
    headerText: string;
    choices: TokenChoiceDialogChoice[];
    isOwnerView: boolean;
    onSelect?: (index: number) => Promise<void> | void;
  };

  constructor(scene: Phaser.Scene, timerController?: TurnTimerController) {
    const cfg = {
      ...DEFAULT_CARD_DIALOG_CONFIG,
      z: { ...DEFAULT_CARD_DIALOG_CONFIG.z, dialog: 3100, overlay: 3099 },
    };
    this.dialog = new CardRowChoiceDialog<RenderCard>(scene, cfg, timerController);
  }

  isOpen() {
    return this.dialog.isOpen();
  }

  hide() {
    this.dialog.hide();
    this.automationState = undefined;
  }

  show(opts: TokenChoiceDialogOptions) {
    const choices = Array.isArray(opts.choices) ? opts.choices : [];
    const cards: RenderCard[] = choices.map((choice) => {
      const cardId = (choice.cardId ?? "").toString() || undefined;
      return {
        __choiceIndex: Number(choice.index ?? 0),
        __enabled: choice.enabled !== false,
        cardId,
        // Use a non-standard type to suppress AP/HP badges in TrashCardGridRenderer.
        cardType: "token",
        cardData: cardId ? { id: cardId, name: "", cardType: "token" } : undefined,
        textureKey: this.resolveTextureKey(cardId),
      };
    });

    this.automationState = {
      headerText: opts.headerText ?? "Choose token to play",
      choices: choices.map((choice) => ({
        index: Number(choice.index ?? 0),
        cardId: choice.cardId,
        enabled: choice.enabled !== false,
      })),
      isOwnerView: opts.showChoices ?? true,
      onSelect: opts.onSelect,
    };

    this.dialog.show({
      headerText: opts.headerText ?? "Choose token to play",
      cards,
      showCards: opts.showChoices ?? true,
      emptyMessage: "Opponent is deciding...",
      showOverlay: opts.showOverlay ?? true,
      showTimer: opts.showTimer ?? false,
      colsMax: 3,
      cardTypeOverrides: {
        cardConfig: {
          // Tokens shouldn't reserve badge/footer space.
          frameExtra: { ...DEFAULT_CARD_DIALOG_CONFIG.card.frameExtra, h: 0 },
          extraCellHeight: 0,
        },
      },
      isCardEnabled: (card) => card.__enabled,
      onSelectCard: async (card) => {
        await opts.onSelect?.(card.__choiceIndex);
      },
      onTimeout: async () => {
        await opts.onTimeout?.();
      },
    });
  }

  getAutomationState() {
    if (!this.dialog.isOpen() || !this.automationState) return null;
    return {
      open: true,
      headerText: this.automationState.headerText,
      choices: this.automationState.choices.map((choice) => ({
        index: choice.index,
        cardId: choice.cardId,
        enabled: choice.enabled !== false,
      })),
      isOwnerView: this.automationState.isOwnerView,
    };
  }

  async choose(index: number): Promise<boolean> {
    if (!this.dialog.isOpen() || !this.automationState) return false;
    const target = this.automationState.choices.find((choice) => choice.index === index);
    if (!target || target.enabled === false || !this.automationState.onSelect) return false;
    await Promise.resolve(this.automationState.onSelect(index));
    return true;
  }

  private resolveTextureKey(cardId?: string) {
    if (!cardId) return undefined;
    const base = toBaseKey(cardId);
    // Prefer full card art if loaded; otherwise let TrashCardGridRenderer fall back to preview keys.
    return base ? base : undefined;
  }
}
