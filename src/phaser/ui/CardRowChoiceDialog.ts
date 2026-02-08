import Phaser from "phaser";
import { DEFAULT_CARD_DIALOG_CONFIG, computeDialogLayout, createDialogShell, type CardDialogConfig } from "./CardDialogLayout";
import { TrashCardGridRenderer } from "./TrashCardGridRenderer";
import { DialogTimerPresenter } from "./DialogTimerPresenter";
import type { TurnTimerController } from "../controllers/TurnTimerController";

export type CardRowChoiceDialogOptions<TCard> = {
  headerText: string;
  cards: TCard[];
  showCards?: boolean;
  emptyMessage?: string;
  showOverlay?: boolean;
  showTimer?: boolean;
  colsMax?: number;
  onSelectCard?: (card: TCard) => Promise<void> | void;
  isCardEnabled?: (card: TCard) => boolean;
  onTimeout?: () => Promise<void> | void;
  cardTypeOverrides?: { cardConfig?: Partial<CardDialogConfig["card"]> };
};

export class CardRowChoiceDialog<TCard extends Record<string, any>> {
  private overlay?: Phaser.GameObjects.Rectangle;
  private dialog?: Phaser.GameObjects.Container;
  private content?: Phaser.GameObjects.Container;
  private gridRenderer: TrashCardGridRenderer;
  private dialogTimer: DialogTimerPresenter;
  private open = false;

  constructor(
    private scene: Phaser.Scene,
    private cfg: CardDialogConfig = DEFAULT_CARD_DIALOG_CONFIG,
    timerController?: TurnTimerController,
  ) {
    this.gridRenderer = new TrashCardGridRenderer(scene);
    this.dialogTimer = new DialogTimerPresenter(scene, timerController);
  }

  isOpen() {
    return this.open;
  }

  hide() {
    this.dialogTimer.stop();
    this.overlay?.destroy();
    this.dialog?.destroy();
    this.overlay = undefined;
    this.dialog = undefined;
    this.content = undefined;
    this.open = false;
  }

  show(opts: CardRowChoiceDialogOptions<TCard>) {
    this.hide();
    const cam = this.scene.cameras.main;
    const showCards = opts.showCards ?? true;
    const showOverlay = opts.showOverlay ?? true;
    const showTimer = opts.showTimer ?? false;
    const cards = Array.isArray(opts.cards) ? opts.cards : [];
    const colsMax = Math.max(1, Math.floor(opts.colsMax ?? this.cfg.dialog.cols));
    const cols = Math.max(1, Math.min(colsMax, cards.length || 1));
    const visibleRows = 1;

    const layout = computeDialogLayout(cam, this.cfg, { cols, visibleRows });
    const { dialog, overlay, content } = createDialogShell(this.scene, this.cfg, layout, {
      centerX: cam.centerX,
      centerY: cam.centerY,
      headerText: opts.headerText,
      showOverlay,
      closeOnBackdrop: false,
      showCloseButton: false,
    });
    this.dialog = dialog;
    this.overlay = overlay;
    this.content = content;
    this.open = true;

    if (!showCards) {
      const msg = this.scene.add.text(0, 20, opts.emptyMessage ?? "Opponent is deciding...", {
        fontSize: "16px",
        fontFamily: "Arial",
        fontStyle: "bold",
        color: "#f5f6f7",
        align: "center",
        wordWrap: { width: Math.min(520, layout.dialogWidth - layout.margin * 2) },
      });
      msg.setOrigin(0.5);
      content.add([msg]);
      if (showTimer) {
        this.dialogTimer.attach(dialog, layout, async () => {
          await opts.onTimeout?.();
        });
      }
      return;
    }

    const startX = -layout.dialogWidth / 2 + layout.margin + layout.cellWidth / 2;
    const startY = -layout.dialogHeight / 2 + layout.headerOffset + 40 + layout.cellHeight / 2;
    const cardConfig = opts.cardTypeOverrides?.cardConfig ? { ...this.cfg.card, ...opts.cardTypeOverrides.cardConfig } : this.cfg.card;

    const isEnabled = (card: TCard) => opts.isCardEnabled?.(card) !== false;
    this.gridRenderer.render({
      container: content,
      cards,
      cols,
      gap: layout.gap,
      startX,
      startY,
      cellWidth: layout.cellWidth,
      cellHeight: layout.cellHeight,
      cardConfig,
      badgeConfig: this.cfg.badge,
      typeOverrides: this.cfg.cardTypeOverrides,
      isCardInteractive: isEnabled,
      onPointerUp: async (card: any) => {
        if (!isEnabled(card)) return;
        await opts.onSelectCard?.(card);
      },
    });

    if (showTimer) {
      this.dialogTimer.attach(dialog, layout, async () => {
        await opts.onTimeout?.();
      });
    }
  }
}

