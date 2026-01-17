import Phaser from "phaser";
import { DEFAULT_CARD_DIALOG_CONFIG, computeDialogLayout, createDialogShell } from "./CardDialogLayout";
import { TrashCardGridRenderer } from "./TrashCardGridRenderer";
import { DialogTimerPresenter } from "./DialogTimerPresenter";
import { UI_LAYOUT } from "./UiLayoutConfig";
import { PreviewController } from "./PreviewController";
import { DrawHelpers } from "./HeaderHandler";
import { HandLayoutRenderer } from "./HandLayoutRenderer";
import type { Palette } from "./types";
import type { TurnTimerController } from "../controllers/TurnTimerController";

export type BurstChoiceDialogOptions = {
  card: any;
  header?: string;
  showButtons?: boolean;
  showTimer?: boolean;
  showOverlay?: boolean;
  onTrigger?: () => Promise<void> | void;
  onCancel?: () => Promise<void> | void;
  onTimeout?: () => Promise<void> | void;
};

export class BurstChoiceDialog {
  private overlay?: Phaser.GameObjects.Rectangle;
  private dialog?: Phaser.GameObjects.Container;
  private content?: Phaser.GameObjects.Container;
  private gridRenderer: TrashCardGridRenderer;
  private dialogTimer: DialogTimerPresenter;
  private previewController: PreviewController;
  private previewLayout: HandLayoutRenderer;
  private buttonTargets: Phaser.GameObjects.Rectangle[] = [];
  private open = false;

  private cfg = DEFAULT_CARD_DIALOG_CONFIG;

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

  show(opts: BurstChoiceDialogOptions) {
    this.hide();
    const cam = this.scene.cameras.main;
    const headerText = opts.header || "Burst Card";
    const showButtons = opts.showButtons ?? false;
    const showTimer = opts.showTimer ?? false;
    const showOverlay = opts.showOverlay ?? false;
    const extraButtonHeight = showButtons ? 70 : 0;
    const cfg = {
      ...this.cfg,
      dialog: {
        ...this.cfg.dialog,
        extraHeight: this.cfg.dialog.extraHeight + extraButtonHeight,
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
    const startY =
      -layout.dialogHeight / 2 + layout.headerOffset + 40 + layout.cellHeight / 2;

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

    if (showButtons) {
      const buttonHeight = 40;
      const buttonGap = 18;
      const buttonWidth = 160;
      const buttonY = startY + layout.cellHeight / 2 + 22 + buttonHeight / 2;
      const totalWidth = buttonWidth * 2 + buttonGap;
      const startBtnX = -totalWidth / 2 + buttonWidth / 2;
      const triggerX = startBtnX;
      const cancelX = startBtnX + buttonWidth + buttonGap;

      const makeButton = (x: number, label: string, onClick?: () => Promise<void> | void) => {
        const rect = this.scene.add.rectangle(x, buttonY, buttonWidth, buttonHeight, 0x2f3238, 1);
        rect.setStrokeStyle(2, 0x5b6068, 1);
        rect.setInteractive({ useHandCursor: true });
        rect.on("pointerup", async () => {
          await onClick?.();
        });
        const text = this.scene.add.text(x, buttonY, label, {
          fontSize: "15px",
          fontFamily: "Arial",
          fontStyle: "bold",
          color: "#f5f6f7",
          align: "center",
          wordWrap: { width: buttonWidth - 16 },
        });
        text.setOrigin(0.5);
        content.add([rect, text]);
        this.buttonTargets.push(rect);
      };

      makeButton(triggerX, "Trigger Effect", opts.onTrigger);
      makeButton(cancelX, "Cancel", opts.onCancel);
    }

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
