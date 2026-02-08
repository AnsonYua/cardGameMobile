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

  private resolveTextureKey(cardId?: string) {
    if (!cardId) return undefined;
    const base = toBaseKey(cardId);
    // Prefer full card art if loaded; otherwise let TrashCardGridRenderer fall back to preview keys.
    return base ? base : undefined;
  }
}

