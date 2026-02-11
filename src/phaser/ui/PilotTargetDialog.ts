import Phaser from "phaser";
import type { SlotViewModel } from "./SlotTypes";
import { UI_LAYOUT } from "./UiLayoutConfig";
import { PreviewController } from "./PreviewController";
import { renderSlotPreviewCard } from "./SlotPreviewRenderer";
import { renderTargetDialogSlot } from "./TargetDialogSlotRenderer";
import { DialogTimerPresenter } from "./DialogTimerPresenter";
import type { TurnTimerController } from "../controllers/TurnTimerController";
import { MultiTargetDialog, type MultiTargetDialogShowOpts } from "./MultiTargetDialog";
import { ScrollList } from "./ScrollList";

export type PilotTargetDialogShowOpts = {
  targets: SlotViewModel[];
  onSelect: (slot: SlotViewModel) => Promise<void> | void;
  header?: string;
  allowPiloted?: boolean;
  closeOnBackdrop?: boolean;
  showCloseButton?: boolean;
  onClose?: () => void;
};

export type { MultiTargetDialogShowOpts };

export class PilotTargetDialog {
  private overlay?: Phaser.GameObjects.Rectangle;
  private dialog?: Phaser.GameObjects.Container;
  private openSingle = false;
  private lastTargets: SlotViewModel[] = [];
  private lastOnSelect?: (slot: SlotViewModel) => Promise<void> | void;
  private lastOnClose?: (() => void) | undefined;
  private previewController: PreviewController;
  private dialogTimer: DialogTimerPresenter;
  private multiDialog: MultiTargetDialog;
  private scrollList?: ScrollList;

  private cfg = {
    z: { overlay: 2599, dialog: 2600 },
    overlayAlpha: 0.45,
    dialog: {
      cols: 3,
      rows: 2,
      margin: 12,
      gap: 16,
      widthFactor: 0.92,
      minWidth: 360,
      minHeight: 260,
      panelRadius: 18,
      extraHeight: 90,
      headerOffset: 34,
      closeSize: 22,
      closeOffset: 12,
      headerWrapPad: 80,
      scrollbarWidth: 8,
      scrollbarPad: 6,
      scrollbarMinThumb: 24,
    },
    card: {
      aspect: 88 / 64,
      widthFactor: 1.04,
      framePadding: 4,
      frameExtra: { w: 0, h: 20 },
      frameStroke: 0,
      frameColor: 0xffffff,
      extraCellHeight: 20,
    },
    badges: {
      size: { w: 30, h: 15 },
      totalGap: 2,
      fontSize: 12,
      pilotFontSize: 12,
      pilotSpacing: 5,
      pilotOffsetRatio: 0.2,
      pilotCommandOffsetRatio: 0.1,
      pilotCommandLift: 10,
      unitYOffsetFactor: -0.4,
    },
  };

  constructor(
    private scene: Phaser.Scene,
    private createSlotSprite?: (slot: SlotViewModel, size: { w: number; h: number }) => Phaser.GameObjects.Container | undefined,
    timerController?: TurnTimerController,
  ) {
    this.previewController = new PreviewController(scene, {
      overlayAlpha: UI_LAYOUT.slot.preview.overlayAlpha,
      fadeIn: UI_LAYOUT.slot.preview.fadeIn,
      fadeOut: UI_LAYOUT.slot.preview.fadeOut,
      holdDelay: UI_LAYOUT.slot.preview.holdDelay,
      depth: 5000,
    });
    this.dialogTimer = new DialogTimerPresenter(scene, timerController);
    this.multiDialog = new MultiTargetDialog(scene, this.cfg, this.previewController, createSlotSprite);
  }

  isOpen() {
    return this.openSingle || this.multiDialog.isOpen();
  }

  async hide(): Promise<void> {
    const overlay = this.overlay;
    const dialog = this.dialog;
    const onClose = this.lastOnClose;
    const scrollList = this.scrollList;

    // Clear references immediately to avoid a race where `show()` calls `void this.hide()` and
    // this async method destroys the newly-created dialog after the first await.
    this.overlay = undefined;
    this.dialog = undefined;
    this.scrollList = undefined;
    this.lastTargets = [];
    this.lastOnSelect = undefined;
    this.lastOnClose = undefined;
    this.openSingle = false;

    await this.multiDialog.hide();
    this.previewController.hide(true);
    this.dialogTimer.stop();
    scrollList?.destroy();
    overlay?.destroy();
    dialog?.destroy();
    onClose?.();
  }

  show(opts: PilotTargetDialogShowOpts) {
    void this.hide();
    const cam = this.scene.cameras.main;
    const closeOnBackdrop = opts.closeOnBackdrop ?? true;
    const showCloseButton = opts.showCloseButton ?? true;
    const filtered = opts.targets.filter((t) => {
      const hasUnit = !!t.unit;
      const hasPilot = !!t.pilot;
      if (opts.allowPiloted) return hasUnit || hasPilot;
      return hasUnit && !hasPilot;
    });
    const targets = filtered;
    this.lastTargets = targets;
    this.lastOnSelect = opts.onSelect;
    this.lastOnClose = opts.onClose;

    const {
      cols,
      rows,
      margin,
      gap,
      widthFactor,
      minWidth,
      minHeight,
      extraHeight,
      panelRadius,
      headerOffset,
      closeSize,
      closeOffset,
      headerWrapPad,
      scrollbarWidth,
      scrollbarPad,
      scrollbarMinThumb,
    } = this.cfg.dialog;
    const { aspect, widthFactor: cardWidthFactor, framePadding, extraCellHeight, frameExtra } = this.cfg.card;
    const dialogWidth = Math.max(minWidth, cam.width * widthFactor);
    const visibleRows = targets.length <= cols ? 1 : rows;
    const totalRows = Math.max(visibleRows, Math.ceil(targets.length / cols));
    const useScroll = totalRows > visibleRows;
    const reservedScrollbarWidth = useScroll ? scrollbarWidth : 0;
    const reservedScrollbarPad = useScroll ? scrollbarPad : 0;
    const gridWidth = dialogWidth - margin * 2 - reservedScrollbarWidth - reservedScrollbarPad;
    const cellWidth = (gridWidth - gap * (cols - 1)) / cols;
    const cardHeight = cellWidth * aspect;
    const cellHeight = cardHeight + extraCellHeight;
    const gridVisibleHeight = visibleRows * cellHeight + (visibleRows - 1) * gap;
    const gridTotalHeight = totalRows * cellHeight + (totalRows - 1) * gap;
    const timerGap = 22;
    const dialogHeight = Math.max(minHeight, gridVisibleHeight + extraHeight + timerGap);

    this.overlay = this.scene.add
      .rectangle(cam.centerX, cam.centerY, cam.width, cam.height, 0x000000, this.cfg.overlayAlpha)
      .setInteractive({ useHandCursor: closeOnBackdrop })
      .setDepth(this.cfg.z.overlay);
    if (closeOnBackdrop) {
      this.overlay.on("pointerup", () => void this.hide());
    }

    const dialog = this.scene.add.container(cam.centerX, cam.centerY);
    dialog.setDepth(this.cfg.z.dialog);
    this.dialog = dialog;

    const panel = this.scene.add.graphics({ x: 0, y: 0 });
    panel.fillStyle(0x3a3d42, 0.95);
    panel.fillRoundedRect(-dialogWidth / 2, -dialogHeight / 2, dialogWidth, dialogHeight, panelRadius);
    panel.lineStyle(2, 0x5b6068, 1);
    panel.strokeRoundedRect(-dialogWidth / 2, -dialogHeight / 2, dialogWidth, dialogHeight, panelRadius);
    dialog.add(panel);

    const content = this.scene.add.container(0, 0);
    dialog.add(content);

    if (showCloseButton) {
      const closeButton = this.scene.add.rectangle(
        dialogWidth / 2 - closeSize - closeOffset,
        -dialogHeight / 2 + closeSize + closeOffset - 10,
        closeSize,
        closeSize,
        0xffffff,
        0.12,
      );
      closeButton.setStrokeStyle(2, 0xffffff, 0.5);
      closeButton.setInteractive({ useHandCursor: true });
      closeButton.on("pointerup", () => void this.hide());
      const closeLabel = this.scene.add
        .text(closeButton.x, closeButton.y, "✕", { fontSize: "15px", fontFamily: "Arial", color: "#f5f6f7", align: "center" })
        .setOrigin(0.5);
      dialog.add([closeButton, closeLabel]);
    }

    const headerText = opts.header || "Choose a Unit";
    const header = this.scene.add
      .text(0, -dialogHeight / 2 + headerOffset - 10, headerText, {
        fontSize: "20px",
        fontFamily: "Arial",
        fontStyle: "bold",
        color: "#f5f6f7",
        align: "center",
        wordWrap: { width: dialogWidth - headerWrapPad },
      })
      .setOrigin(0.5);
    dialog.add(header);

    const startX = -dialogWidth / 2 + margin + cellWidth / 2;
    const startY = -dialogHeight / 2 + headerOffset + 40 + timerGap + cellHeight / 2;

    const maxCells = cols * totalRows;
    for (let i = 0; i < maxCells; i++) {
      const slot = targets[i];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (cellWidth + gap);
      const y = startY + row * (cellHeight + gap);
      const cardW = cellWidth * cardWidthFactor;
      const cardH = cardW * aspect;

      const frameY = y + frameExtra.h / 2;
      const frame = this.scene.add.rectangle(
        x,
        frameY,
        cardW + framePadding + this.cfg.card.frameExtra.w,
        cardH + framePadding + this.cfg.card.frameExtra.h,
        0x1b1e24,
        0.75,
      );
      const isSelectable = !!slot?.unit || (!!slot?.pilot && opts.allowPiloted);
      frame.setStrokeStyle(this.cfg.card.frameStroke, this.cfg.card.frameColor, 0.95);
      frame.setInteractive({ useHandCursor: isSelectable });
      frame.on("pointerdown", () => {
        if (!slot || !isSelectable) return;
        this.startPreviewTimer(slot);
      });
      frame.on("pointerup", async () => {
        if (this.previewController.isActive()) return;
        this.previewController.cancelPending();
        if (!slot || !isSelectable) return;
        await opts.onSelect(slot);
        await this.hide();
      });
      frame.on("pointerout", () => {
        if (this.previewController.isActive()) return;
        this.previewController.cancelPending();
      });
      content.add(frame);

      const slotSprite = slot ? this.createSlotSprite?.(slot, { w: cardW, h: cardH }) : undefined;
      if (slotSprite) {
        slotSprite.setPosition(x, y);
        content.add(slotSprite);
      } else {
        renderTargetDialogSlot({
          scene: this.scene,
          container: content,
          slot,
          x,
          y,
          cardW,
          cardH,
          badges: this.cfg.badges,
        });
      }
    }

    if (!targets.length) {
      const empty = this.scene.add
        .text(0, startY, "No units available", { fontSize: "15px", fontFamily: "Arial", color: "#d7d9dd", align: "center" })
        .setOrigin(0.5);
      dialog.add(empty);
    }

    if (useScroll) {
      const scrollBounds = {
        x: -dialogWidth / 2 + margin,
        y: startY - cellHeight / 2,
        width: dialogWidth - margin * 2,
        height: gridVisibleHeight,
      };
      const trackX = dialogWidth / 2 - scrollbarWidth / 2 - scrollbarPad;
      this.scrollList = new ScrollList(this.scene, dialog, content, scrollBounds, {
        width: scrollbarWidth,
        pad: scrollbarPad,
        minThumb: scrollbarMinThumb,
        trackX,
      });
      this.scrollList.setContentHeight(gridTotalHeight);
      this.scrollList.attach();
    }

    this.dialogTimer.attach(
      dialog,
      {
        dialogWidth,
        dialogHeight,
        cellWidth,
        cellHeight,
        cardHeight,
        gridVisibleHeight,
        margin,
        gap,
        headerOffset,
        headerWrapPad,
        cols,
        visibleRows,
      },
      async () => {
        const selected = await this.selectTarget(0);
        if (selected) await this.hide();
      },
    );

    dialog.setDepth(2600);
    this.scene.add.existing(dialog);
    this.openSingle = true;
  }

  showMulti(opts: MultiTargetDialogShowOpts) {
    void this.hide();
    this.multiDialog.show(opts);
  }

  async selectTarget(index = 0): Promise<boolean> {
    const target = this.lastTargets[index];
    if (!this.openSingle || !target || !this.lastOnSelect) return false;
    await this.lastOnSelect(target);
    return true;
  }

  private startPreviewTimer(slot: SlotViewModel) {
    const cardW = UI_LAYOUT.slot.preview.cardWidth;
    const cardH = cardW * UI_LAYOUT.slot.preview.cardAspect;
    this.previewController.start((container) => {
      renderSlotPreviewCard({
        scene: this.scene,
        container,
        slot,
        x: 0,
        y: 0,
        w: cardW,
        h: cardH,
        depthOffset: 0,
      });
    });
  }
}
