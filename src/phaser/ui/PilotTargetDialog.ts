import Phaser from "phaser";
import type { SlotViewModel } from "./SlotTypes";
import { UI_LAYOUT } from "./UiLayoutConfig";
import { PreviewController } from "./PreviewController";
import { renderSlotPreviewCard } from "./SlotPreviewRenderer";
import { renderTargetDialogSlot } from "./TargetDialogSlotRenderer";
import { DialogTimerPresenter } from "./DialogTimerPresenter";
import type { TurnTimerController } from "../controllers/TurnTimerController";

export type PilotTargetDialogShowOpts = {
  targets: SlotViewModel[];
  onSelect: (slot: SlotViewModel) => Promise<void> | void;
  header?: string;
  allowPiloted?: boolean;
  closeOnBackdrop?: boolean;
  showCloseButton?: boolean;
  onClose?: () => void;
};

export type MultiTargetDialogShowOpts = {
  targets: SlotViewModel[];
  onConfirm: (slots: SlotViewModel[]) => Promise<void> | void;
  header?: string;
  allowPiloted?: boolean;
  closeOnBackdrop?: boolean;
  showCloseButton?: boolean;
  onClose?: () => void;
  min: number;
  max: number;
};

export class PilotTargetDialog {
  private overlay?: Phaser.GameObjects.Rectangle;
  private dialog?: Phaser.GameObjects.Container;
  private open = false;
  private lastTargets: SlotViewModel[] = [];
  private lastOnSelect?: (slot: SlotViewModel) => Promise<void> | void;
  private lastOnConfirm?: (slots: SlotViewModel[]) => Promise<void> | void;
  private lastOnClose?: (() => void) | undefined;
  private previewController: PreviewController;
  private dialogTimer: DialogTimerPresenter;
  private selectedTargets: SlotViewModel[] = [];
  private lastMulti?: { min: number; max: number };
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
    },
    card: {
      aspect: 88 / 64,
      widthFactor: 1.04,
      framePadding: 4,
      frameExtra: { w: 0, h: 36 },
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
  }

  async hide(): Promise<void> {
    this.previewController.hide(true);
    this.dialogTimer.stop();
    this.overlay?.destroy();
    this.dialog?.destroy();
    this.overlay = undefined;
    this.dialog = undefined;
    this.lastTargets = [];
    this.lastOnSelect = undefined;
    this.lastOnConfirm = undefined;
    this.selectedTargets = [];
    this.lastMulti = undefined;
    const onClose = this.lastOnClose;
    this.lastOnClose = undefined;
    this.open = false;
    onClose?.();
  }

  isOpen() {
    return this.open;
  }

  show(opts: PilotTargetDialogShowOpts) {
    this.lastOnConfirm = undefined;
    this.lastMulti = undefined;
    this.hide();
    const cam = this.scene.cameras.main;
    const closeOnBackdrop = opts.closeOnBackdrop ?? true;
    const showCloseButton = opts.showCloseButton ?? true;
    // Only show slots that have something to display; original dialog hides piloted slots unless allowed.
    const filtered = opts.targets.filter((t) => {
      const hasUnit = !!t.unit;
      const hasPilot = !!t.pilot;
      if (opts.allowPiloted) {
        return hasUnit || hasPilot;
      }
      return hasUnit && !hasPilot;
    });
    const targets = filtered.slice(0, 6);
    this.lastTargets = targets;
    this.lastOnSelect = opts.onSelect;
    this.selectedTargets = [];
    this.lastOnClose = opts.onClose;
    const { cols, rows, margin, gap, widthFactor, minWidth, minHeight, extraHeight, panelRadius, headerOffset, closeSize, closeOffset, headerWrapPad } =
      this.cfg.dialog;
    const rowCount = targets.length <= cols ? 1 : rows;
    const { aspect, widthFactor: cardWidthFactor, framePadding, extraCellHeight } = this.cfg.card;
    const dialogWidth = Math.max(minWidth, cam.width * widthFactor);
    const cellWidth = (dialogWidth - margin * 2 - gap * (cols - 1)) / cols;
    const cardHeight = cellWidth * aspect;
    const cellHeight = cardHeight + extraCellHeight;
    const gridHeight = rowCount * cellHeight + (rowCount - 1) * gap;
    const timerGap = 22;
    const dialogHeight = Math.max(minHeight, gridHeight + extraHeight + timerGap);

    this.overlay = this.scene.add
      .rectangle(cam.centerX, cam.centerY, cam.width, cam.height, 0x000000, this.cfg.overlayAlpha)
      .setInteractive({ useHandCursor: closeOnBackdrop })
      .setDepth(this.cfg.z.overlay);
    if (closeOnBackdrop) {
      this.overlay.on("pointerup", () => {
        void this.hide();
      });
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

    let closeButton: Phaser.GameObjects.Rectangle | undefined;
    let closeLabel: Phaser.GameObjects.Text | undefined;
    if (showCloseButton) {
      closeButton = this.scene.add.rectangle(
        dialogWidth / 2 - closeSize - closeOffset,
        -dialogHeight / 2 + closeSize + closeOffset-10,
        closeSize,
        closeSize,
        0xffffff,
        0.12,
      );
      closeButton.setStrokeStyle(2, 0xffffff, 0.5);
      closeButton.setInteractive({ useHandCursor: true });
      closeButton.on("pointerup", () => {
        void this.hide();
      });
      closeLabel = this.scene.add
        .text(closeButton.x, closeButton.y, "✕", { fontSize: "15px", fontFamily: "Arial", color: "#f5f6f7", align: "center" })
        .setOrigin(0.5);
    }

    const headerText = opts.header || "Choose a Unit";
    const header = this.scene.add.text(0, -dialogHeight / 2 + headerOffset-10, headerText, {
      fontSize: "20px",
      fontFamily: "Arial",
      fontStyle: "bold",
      color: "#f5f6f7",
      align: "center",
      wordWrap: { width: dialogWidth - headerWrapPad },
    }).setOrigin(0.5);

    const startX = -dialogWidth / 2 + margin + cellWidth / 2;
    const startY = -dialogHeight / 2 + headerOffset + 40 + timerGap + cellHeight / 2;

    const maxCells = cols * rowCount;
    for (let i = 0; i < maxCells; i++) {
      const slot = targets[i];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (cellWidth + gap);
      const y = startY + row * (cellHeight + gap);
      const cardW = cellWidth * cardWidthFactor;
      const cardH = cardW * aspect;

      const frame = this.scene.add.rectangle(
        x,
        y,
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
      dialog.add(frame);

      const slotSprite = slot ? this.createSlotSprite?.(slot, { w: cardW, h: cardH }) : undefined;
      if (slotSprite) {
        slotSprite.setPosition(x, y);
        dialog.add(slotSprite);
      } else {
        renderTargetDialogSlot({
          scene: this.scene,
          container: dialog,
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
      const empty = this.scene.add.text(0, startY, "No units available", {
        fontSize: "15px",
        fontFamily: "Arial",
        color: "#d7d9dd",
        align: "center",
      }).setOrigin(0.5);
      dialog.add(empty);
    }

    dialog.add([header]);
    if (showCloseButton && closeButton && closeLabel) {
      dialog.add([closeButton, closeLabel]);
    }
    this.dialogTimer.attach(dialog, {
      dialogWidth,
      dialogHeight,
      cellWidth,
      cellHeight,
      cardHeight,
      gridVisibleHeight: gridHeight,
      margin,
      gap,
      headerOffset,
      headerWrapPad,
      cols,
      visibleRows: rowCount,
    }, async () => {
      const selected = await this.selectTarget(0);
      if (selected) {
        await this.hide();
      }
    });
    dialog.setDepth(2600);
    this.scene.add.existing(dialog);
    this.open = true;
  }

  showMulti(opts: MultiTargetDialogShowOpts) {
    try {
      this.hide();
      this.lastOnSelect = undefined;
      const min = Math.max(0, Number(opts.min) || 0);
      const max = Math.max(1, Number(opts.max) || 1);
      this.lastMulti = { min, max };
      const cam = this.scene.cameras.main;
      const closeOnBackdrop = opts.closeOnBackdrop ?? false;
      const showCloseButton = opts.showCloseButton ?? true;
      const filtered = opts.targets.filter((t) => {
        const hasUnit = !!t.unit;
        const hasPilot = !!t.pilot;
        if (opts.allowPiloted) return hasUnit || hasPilot;
        return hasUnit && !hasPilot;
      });
      const targets = filtered.slice(0, 6);
      this.lastTargets = targets;
      this.selectedTargets = [];
      this.lastOnConfirm = opts.onConfirm;
      this.lastOnClose = opts.onClose;

    const { cols, rows, margin, gap, widthFactor, minWidth, minHeight, extraHeight, panelRadius, headerOffset, closeSize, closeOffset, headerWrapPad } =
      this.cfg.dialog;
    const rowCount = targets.length <= cols ? 1 : rows;
    const { aspect, widthFactor: cardWidthFactor, framePadding, extraCellHeight } = this.cfg.card;
    const dialogWidth = Math.max(minWidth, cam.width * widthFactor);
    const cellWidth = (dialogWidth - margin * 2 - gap * (cols - 1)) / cols;
    const cardHeight = cellWidth * aspect;
    const cellHeight = cardHeight + extraCellHeight;
    const gridHeight = rowCount * cellHeight + (rowCount - 1) * gap;
    const timerGap = 22;
    const dialogHeight = Math.max(minHeight, gridHeight + extraHeight + timerGap);

      this.overlay = this.scene.add
      .rectangle(cam.centerX, cam.centerY, cam.width, cam.height, 0x000000, this.cfg.overlayAlpha)
      .setInteractive({ useHandCursor: closeOnBackdrop })
      .setDepth(this.cfg.z.overlay);
    if (closeOnBackdrop) {
      this.overlay.on("pointerup", () => {
        void this.hide();
      });
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

      let closeButton: Phaser.GameObjects.Rectangle | undefined;
      let closeLabel: Phaser.GameObjects.Text | undefined;
      if (showCloseButton) {
        closeButton = this.scene.add.rectangle(
        dialogWidth / 2 - closeSize - closeOffset,
        -dialogHeight / 2 + closeSize + closeOffset - 10,
        closeSize,
        closeSize,
        0xffffff,
        0.12,
      );
        closeButton.setStrokeStyle(2, 0xffffff, 0.5);
        closeButton.setInteractive({ useHandCursor: true });
        closeButton.on("pointerup", () => {
          void this.hide();
        });
        closeLabel = this.scene.add
        .text(closeButton.x, closeButton.y, "✕", {
          fontSize: "15px",
          fontFamily: "Arial",
          color: "#f5f6f7",
          align: "center",
        })
        .setOrigin(0.5);
      }

      const headerText = opts.header || "Choose Targets";
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

      const counterText = this.scene.add
        .text(0, header.y + 26, `Select ${min}-${max} (${this.selectedTargets.length}/${max})`, {
          fontSize: "14px",
          fontFamily: "Arial",
          color: "#d7d9dd",
          align: "center",
        })
        .setOrigin(0.5);

    const confirmW = 170;
    const confirmH = 42;
    const confirmY = dialogHeight / 2 - 30;
    const confirmBtn = this.scene.add.rectangle(0, confirmY, confirmW, confirmH, 0x1f6feb, 0.85);
    confirmBtn.setStrokeStyle(2, 0xffffff, 0.25);
    const confirmLabel = this.scene.add
      .text(0, confirmY, "Confirm", { fontSize: "16px", fontFamily: "Arial", color: "#f5f6f7" })
      .setOrigin(0.5);

    const setConfirmEnabled = (enabled: boolean) => {
      confirmBtn.setAlpha(enabled ? 0.9 : 0.35);
      confirmBtn.disableInteractive();
      if (enabled) {
        confirmBtn.setInteractive({ useHandCursor: true });
      }
    };
    setConfirmEnabled(false);
    const updateCounter = () => {
      const count = this.selectedTargets.length;
      counterText.setText(`Select ${min}-${max} (${count}/${max})`);
      setConfirmEnabled(count >= min && count <= max);
    };

    confirmBtn.on("pointerup", async () => {
      if (!this.lastOnConfirm || !this.open) return;
      const count = this.selectedTargets.length;
      if (count < min || count > max) return;
      const onConfirm = this.lastOnConfirm;
      setConfirmEnabled(false);
      // Prevent "close" side-effects (e.g. empty-confirm handlers) from firing after a successful confirm.
      this.lastOnClose = undefined;
      try {
        await onConfirm([...this.selectedTargets]);
        await this.hide();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[PilotTargetDialog] confirm failed", err);
        updateCounter();
      }
    });

    const frames: Phaser.GameObjects.Rectangle[] = [];
    const startX = -dialogWidth / 2 + margin + cellWidth / 2;
    const startY = -dialogHeight / 2 + headerOffset + 58 + timerGap + cellHeight / 2;
    const maxCells = cols * rowCount;
    const isSameSlot = (a: SlotViewModel, b: SlotViewModel) => a.owner === b.owner && a.slotId === b.slotId;
    const toggleSelected = (slot: SlotViewModel) => {
      const idx = this.selectedTargets.findIndex((s) => isSameSlot(s, slot));
      if (idx >= 0) {
        this.selectedTargets.splice(idx, 1);
        return;
      }
      if (this.selectedTargets.length >= max) return;
      this.selectedTargets.push(slot);
    };
    const updateFrameStyles = () => {
      for (let i = 0; i < frames.length; i++) {
        const slot = targets[i];
        const frame = frames[i];
        if (!slot) continue;
        const selected = this.selectedTargets.some((s) => isSameSlot(s, slot));
        frame.setStrokeStyle(selected ? 4 : this.cfg.card.frameStroke, selected ? 0x2ecc71 : this.cfg.card.frameColor, 0.95);
      }
    };

    for (let i = 0; i < maxCells; i++) {
      const slot = targets[i];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (cellWidth + gap);
      const y = startY + row * (cellHeight + gap);
      const cardW = cellWidth * cardWidthFactor;
      const cardH = cardW * aspect;

      const frame = this.scene.add.rectangle(
        x,
        y,
        cardW + framePadding + this.cfg.card.frameExtra.w,
        cardH + framePadding + this.cfg.card.frameExtra.h,
        0x1b1e24,
        0.75,
      );
      frames.push(frame);
      const isSelectable = !!slot?.unit || (!!slot?.pilot && opts.allowPiloted);
      frame.setStrokeStyle(this.cfg.card.frameStroke, this.cfg.card.frameColor, 0.95);
      frame.setInteractive({ useHandCursor: isSelectable });
      frame.on("pointerdown", () => {
        if (!slot || !isSelectable) return;
        this.startPreviewTimer(slot);
      });
      frame.on("pointerup", () => {
        if (this.previewController.isActive()) return;
        this.previewController.cancelPending();
        if (!slot || !isSelectable) return;
        toggleSelected(slot);
        updateFrameStyles();
        updateCounter();
      });
      frame.on("pointerout", () => {
        if (this.previewController.isActive()) return;
        this.previewController.cancelPending();
      });
      dialog.add(frame);

      const slotSprite = slot ? this.createSlotSprite?.(slot, { w: cardW, h: cardH }) : undefined;
      if (slotSprite) {
        slotSprite.setPosition(x, y);
        dialog.add(slotSprite);
      } else {
        renderTargetDialogSlot({
          scene: this.scene,
          container: dialog,
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
        .text(0, startY, "No units available", {
          fontSize: "15px",
          fontFamily: "Arial",
          color: "#d7d9dd",
          align: "center",
        })
        .setOrigin(0.5);
      dialog.add(empty);
      setConfirmEnabled(false);
    }

      dialog.add([header, counterText, confirmBtn, confirmLabel]);
      if (showCloseButton && closeButton && closeLabel) {
        dialog.add([closeButton, closeLabel]);
      }
      dialog.setDepth(2600);
      this.scene.add.existing(dialog);
      this.open = true;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[PilotTargetDialog] showMulti failed", err);
      void this.hide();
    }
  }

  async selectTarget(index = 0): Promise<boolean> {
    const target = this.lastTargets[index];
    if (!this.open || !target || !this.lastOnSelect) return false;
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
