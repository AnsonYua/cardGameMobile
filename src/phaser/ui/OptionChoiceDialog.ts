import Phaser from "phaser";
import { DEFAULT_CARD_DIALOG_CONFIG, computeDialogLayout, createDialogShell } from "./CardDialogLayout";
import { TrashCardGridRenderer } from "./TrashCardGridRenderer";
import { DialogTimerPresenter } from "./DialogTimerPresenter";
import { PreviewController } from "./PreviewController";
import { UI_LAYOUT } from "./UiLayoutConfig";
import { DrawHelpers } from "./HeaderHandler";
import { HandLayoutRenderer } from "./HandLayoutRenderer";
import type { Palette } from "./types";
import type { TurnTimerController } from "../controllers/TurnTimerController";

export type OptionChoiceDialogOption = {
  index: number;
  label: string;
  enabled?: boolean;
};

export type OptionChoiceDialogOptions = {
  headerText?: string;
  card?: any;
  options: OptionChoiceDialogOption[];
  showButtons?: boolean;
  showOverlay?: boolean;
  showTimer?: boolean;
  onSelect?: (index: number) => Promise<void> | void;
  onTimeout?: () => Promise<void> | void;
};

export class OptionChoiceDialog {
  private overlay?: Phaser.GameObjects.Rectangle;
  private dialog?: Phaser.GameObjects.Container;
  private content?: Phaser.GameObjects.Container;
  private gridRenderer: TrashCardGridRenderer;
  private dialogTimer: DialogTimerPresenter;
  private previewController: PreviewController;
  private previewLayout: HandLayoutRenderer;
  private buttonTargets: Phaser.GameObjects.Rectangle[] = [];
  private open = false;

  private cfg = {
    ...DEFAULT_CARD_DIALOG_CONFIG,
    z: { ...DEFAULT_CARD_DIALOG_CONFIG.z, dialog: 3100, overlay: 3099 },
  };

  constructor(private scene: Phaser.Scene, timerController?: TurnTimerController) {
    this.gridRenderer = new TrashCardGridRenderer(scene);
    this.dialogTimer = new DialogTimerPresenter(scene, timerController);
    this.previewController = new PreviewController(scene, {
      overlayAlpha: UI_LAYOUT.hand.preview.overlayAlpha,
      fadeIn: UI_LAYOUT.hand.preview.fadeIn,
      fadeOut: UI_LAYOUT.hand.preview.fadeOut,
      holdDelay: UI_LAYOUT.hand.preview.holdDelay,
      depth: 14000,
    });
    const palette: Palette = {
      ink: "#0f1118",
      slot: "#2a2d38",
      accent: "#d0d5e0",
      text: "#f5f6fb",
      bg: "#ffffff",
    };
    const drawHelpers = new DrawHelpers(scene);
    this.previewLayout = new HandLayoutRenderer(scene, palette, drawHelpers);
  }

  isOpen() {
    return this.open;
  }

  hide() {
    this.previewController.hide(true);
    this.dialogTimer.stop();
    this.buttonTargets.forEach((btn) => btn.disableInteractive());
    this.buttonTargets = [];
    this.overlay?.destroy();
    this.dialog?.destroy();
    this.overlay = undefined;
    this.dialog = undefined;
    this.content = undefined;
    this.open = false;
  }

  show(opts: OptionChoiceDialogOptions) {
    this.hide();
    const cam = this.scene.cameras.main;
    const headerText = opts.headerText ?? "Choose Option";
    const showButtons = opts.showButtons ?? false;
    const showOverlay = opts.showOverlay ?? true;
    const showTimer = opts.showTimer ?? false;
    const options = Array.isArray(opts.options) ? opts.options : [];

    const buttonHeight = 44;
    const buttonGap = 12;
    const buttonBlockHeight =
      showButtons && options.length > 0
        ? options.length * buttonHeight + Math.max(0, options.length - 1) * buttonGap + 26
        : 60;
    const cfg = {
      ...this.cfg,
      dialog: {
        ...this.cfg.dialog,
        // Make room for buttons / opponent waiting message.
        extraHeight: Math.max(this.cfg.dialog.extraHeight, 110 + buttonBlockHeight),
      },
    };

    const cols = cfg.dialog.cols;
    const visibleRows = 1;
    const layout = computeDialogLayout(cam, cfg, { cols, visibleRows });
    const { dialog, overlay, content } = createDialogShell(this.scene, cfg, layout, {
      centerX: cam.centerX,
      centerY: cam.centerY,
      headerText,
      showOverlay,
      closeOnBackdrop: false,
      showCloseButton: false,
    });
    this.dialog = dialog;
    this.overlay = overlay;
    this.content = content;
    this.open = true;

    const colIndex = Math.floor(cols / 2);
    const startX = -layout.dialogWidth / 2 + layout.margin + layout.cellWidth / 2 + colIndex * (layout.cellWidth + layout.gap);
    const startY = -layout.dialogHeight / 2 + layout.headerOffset + 40 + layout.cellHeight / 2;

    if (opts.card) {
      this.gridRenderer.render({
        container: content,
        cards: [opts.card],
        cols,
        gap: layout.gap,
        startX,
        startY,
        cellWidth: layout.cellWidth,
        cellHeight: layout.cellHeight,
        cardConfig: cfg.card,
        badgeConfig: cfg.badge,
        typeOverrides: cfg.cardTypeOverrides,
        onPointerDown: (card) => this.startPreview(card),
        onPointerUp: () => {
          if (this.previewController.isActive()) return;
          this.previewController.cancelPending();
        },
        onPointerOut: () => {
          if (this.previewController.isActive()) return;
          this.previewController.cancelPending();
        },
      });
    }

    const cardBottom = startY + layout.cellHeight / 2;
    if (!showButtons) {
      const msg = this.scene.add.text(0, cardBottom + 30, "Opponent is deciding...", {
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

    const buttonWidth = Math.max(240, Math.min(520, layout.dialogWidth - layout.margin * 2));
    let cursorY = cardBottom + 22 + buttonHeight / 2;
    options.forEach((option) => {
      const enabled = option.enabled !== false;
      const rect = this.scene.add.rectangle(0, cursorY, buttonWidth, buttonHeight, 0x2f3238, enabled ? 1 : 0.45);
      rect.setStrokeStyle(2, 0x5b6068, enabled ? 1 : 0.45);
      if (enabled) {
        rect.setInteractive({ useHandCursor: true });
        rect.on("pointerup", async () => {
          await opts.onSelect?.(option.index);
        });
      }
      const txt = this.scene.add.text(0, cursorY, option.label, {
        fontSize: "15px",
        fontFamily: "Arial",
        fontStyle: "bold",
        color: enabled ? "#f5f6f7" : "#98a0aa",
        align: "center",
        wordWrap: { width: buttonWidth - 18 },
      });
      txt.setOrigin(0.5);
      content.add([rect, txt]);
      this.buttonTargets.push(rect);
      cursorY += buttonHeight + buttonGap;
    });

    if (showTimer) {
      this.dialogTimer.attach(dialog, layout, async () => {
        await opts.onTimeout?.();
      });
    }
  }

  private startPreview(card: any) {
    const cardW = UI_LAYOUT.hand.preview.cardWidth;
    const cardH = cardW * UI_LAYOUT.hand.preview.cardAspect;
    this.previewController.start((container) => {
      const preview = this.gridRenderer.getPreviewData(card);
      this.previewLayout.renderPreview(
        container,
        0,
        0,
        cardW,
        cardH,
        preview.textureKey,
        preview.statLabel,
        preview.previewCard,
        {
          badgeSize: UI_LAYOUT.hand.preview.badgeSize,
          badgeFontSize: UI_LAYOUT.hand.preview.badgeFontSize,
        },
      );
    });
  }
}
