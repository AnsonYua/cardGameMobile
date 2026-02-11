import type Phaser from "phaser";
import type { SlotViewModel } from "./SlotTypes";
import { renderTargetDialogSlot } from "./TargetDialogSlotRenderer";
import { renderSlotPreviewCard } from "./SlotPreviewRenderer";
import type { PreviewController } from "./PreviewController";
import { UI_LAYOUT } from "./UiLayoutConfig";
import { ScrollList } from "./ScrollList";

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

type DialogConfig = {
  z: { overlay: number; dialog: number };
  overlayAlpha: number;
  dialog: {
    cols: number;
    rows: number;
    margin: number;
    gap: number;
    widthFactor: number;
    minWidth: number;
    minHeight: number;
    panelRadius: number;
    extraHeight: number;
    headerOffset: number;
    closeSize: number;
    closeOffset: number;
    headerWrapPad: number;
    scrollbarWidth: number;
    scrollbarPad: number;
    scrollbarMinThumb: number;
  };
  card: {
    aspect: number;
    widthFactor: number;
    framePadding: number;
    frameExtra: { w: number; h: number };
    frameStroke: number;
    frameColor: number;
    extraCellHeight: number;
  };
  badges: any;
};

export class MultiTargetDialog {
  private overlay?: Phaser.GameObjects.Rectangle;
  private dialog?: Phaser.GameObjects.Container;
  private scrollList?: ScrollList;
  private open = false;
  private lastOnClose?: (() => void) | undefined;
  private lastOnConfirm?: ((slots: SlotViewModel[]) => Promise<void> | void) | undefined;
  private selectedTargets: SlotViewModel[] = [];
  private lastTargets: SlotViewModel[] = [];

  constructor(
    private scene: Phaser.Scene,
    private cfg: DialogConfig,
    private previewController: PreviewController,
    private createSlotSprite?: (slot: SlotViewModel, size: { w: number; h: number }) => Phaser.GameObjects.Container | undefined,
  ) {}

  isOpen() {
    return this.open;
  }

  async hide(): Promise<void> {
    this.previewController.hide(true);
    const scrollList = this.scrollList;
    this.overlay?.destroy();
    scrollList?.destroy();
    this.dialog?.destroy();
    this.overlay = undefined;
    this.dialog = undefined;
    this.scrollList = undefined;
    this.open = false;
    this.lastTargets = [];
    this.selectedTargets = [];
    const onClose = this.lastOnClose;
    this.lastOnClose = undefined;
    this.lastOnConfirm = undefined;
    onClose?.();
  }

  show(opts: MultiTargetDialogShowOpts) {
    void this.hide();

    const min = Math.max(0, Number(opts.min) || 0);
    const max = Math.max(1, Number(opts.max) || 1);
    const closeOnBackdrop = opts.closeOnBackdrop ?? false;
    const showCloseButton = opts.showCloseButton ?? false;

    const filtered = opts.targets.filter((t) => {
      const hasUnit = !!t.unit;
      const hasPilot = !!t.pilot;
      if (opts.allowPiloted) return hasUnit || hasPilot;
      return hasUnit && !hasPilot;
    });
    const targets = filtered;
    this.lastTargets = targets;
    this.selectedTargets = [];
    this.lastOnConfirm = opts.onConfirm;
    this.lastOnClose = opts.onClose;

    const cam = this.scene.cameras.main;
    const {
      cols,
      rows,
      margin,
      gap,
      widthFactor,
      minWidth,
      minHeight,
      panelRadius,
      headerOffset,
      closeSize,
      closeOffset,
      headerWrapPad,
      scrollbarWidth,
      scrollbarPad,
      scrollbarMinThumb,
    } = this.cfg.dialog;
    const { aspect, widthFactor: cardWidthFactor, framePadding, extraCellHeight, frameStroke, frameColor, frameExtra } =
      this.cfg.card;
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
    const headerAndTimer = headerOffset + 58 + timerGap;
    const confirmW = 170;
    const confirmH = 42;
    const confirmGap = 20;
    const footerPad = 18;
    const dialogHeight = Math.max(minHeight, headerAndTimer + gridVisibleHeight + confirmGap + confirmH + footerPad);

    const gridTopY = -dialogHeight / 2 + headerOffset + 58 + timerGap;
    const startX = -dialogWidth / 2 + margin + cellWidth / 2;
    const startY = gridTopY + cellHeight / 2;

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
    dialog.add(header);

    const counterText = this.scene.add
      .text(0, header.y + 26, `Select ${min}-${max} (${this.selectedTargets.length}/${max})`, {
        fontSize: "14px",
        fontFamily: "Arial",
        color: "#d7d9dd",
        align: "center",
      })
      .setOrigin(0.5);
    dialog.add(counterText);

    const errorText = this.scene.add
      .text(0, header.y + 46, "", {
        fontSize: "13px",
        fontFamily: "Arial",
        color: "#ff6b6b",
        align: "center",
      })
      .setOrigin(0.5);
    dialog.add(errorText);

    const confirmY = gridTopY + gridVisibleHeight + confirmGap + confirmH / 2;
    const confirmBtn = this.scene.add.rectangle(0, confirmY, confirmW, confirmH, 0x1f6feb, 0.85);
    confirmBtn.setStrokeStyle(2, 0xffffff, 0.25);
    const confirmLabel = this.scene.add
      .text(0, confirmY, "Confirm", { fontSize: "16px", fontFamily: "Arial", color: "#f5f6f7" })
      .setOrigin(0.5);
    dialog.add([confirmBtn, confirmLabel]);

    const setConfirmEnabled = (enabled: boolean) => {
      confirmBtn.setAlpha(enabled ? 0.9 : 0.35);
      confirmBtn.disableInteractive();
      if (enabled) {
        confirmBtn.setInteractive({ useHandCursor: true });
      }
    };
    setConfirmEnabled(false);

    const slotUid = (slot: SlotViewModel) =>
      (slot?.unit?.cardUid || slot?.pilot?.cardUid || "").toString();
    // Some target prompts (ex: selecting multiple cards from the trash) can contain several
    // entries that share the same `slotId` (e.g. "trash"). In those cases, we must use the
    // card uid for identity; otherwise selecting one item appears to select them all.
    const isSameSlot = (a: SlotViewModel, b: SlotViewModel) => {
      const aUid = slotUid(a);
      const bUid = slotUid(b);
      if (aUid && bUid) return aUid === bUid;
      return a.owner === b.owner && a.slotId === b.slotId;
    };
    const frames: Phaser.GameObjects.Rectangle[] = [];
    const ticks: Array<{ bg: Phaser.GameObjects.Arc; label: Phaser.GameObjects.Text }> = [];

    const updateUi = () => {
      const count = this.selectedTargets.length;
      counterText.setText(`Select ${min}-${max} (${count}/${max})`);
      setConfirmEnabled(count >= min && count <= max);
      const needsMore = count < min;
      if (needsMore) {
        const msg = min === max ? `Select exactly ${min}.` : `Select at least ${min}.`;
        errorText.setText(msg);
        errorText.setVisible(true);
      } else {
        errorText.setText("");
        errorText.setVisible(false);
      }
      for (let i = 0; i < frames.length; i++) {
        const slot = targets[i];
        const frame = frames[i];
        if (!slot) continue;
        const selected = this.selectedTargets.some((s) => isSameSlot(s, slot));
        frame.setStrokeStyle(selected ? 3 : frameStroke, selected ? 0x2ecc71 : frameColor, 0.95);
        const tick = ticks[i];
        if (tick) {
          tick.bg.setVisible(selected);
          tick.label.setVisible(selected);
        }
      }
    };

    const toggleSelected = (slot: SlotViewModel) => {
      const idx = this.selectedTargets.findIndex((s) => isSameSlot(s, slot));
      if (idx >= 0) {
        this.selectedTargets.splice(idx, 1);
        return;
      }
      if (this.selectedTargets.length >= max) return;
      this.selectedTargets.push(slot);
    };

    confirmBtn.on("pointerup", async () => {
      if (!this.lastOnConfirm || !this.open) return;
      const count = this.selectedTargets.length;
      if (count < min || count > max) return;
      const onConfirm = this.lastOnConfirm;
      setConfirmEnabled(false);
      this.lastOnClose = undefined;
      try {
        await onConfirm([...this.selectedTargets]);
        await this.hide();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[MultiTargetDialog] confirm failed", err);
        updateUi();
      }
    });

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
        cardW + framePadding + frameExtra.w,
        cardH + framePadding + frameExtra.h,
        0x1b1e24,
        0.75,
      );
      frames.push(frame);
      const isSelectable = !!slot?.unit || (!!slot?.pilot && opts.allowPiloted);
      frame.setStrokeStyle(frameStroke, frameColor, 0.95);
      frame.setInteractive({ useHandCursor: isSelectable });
      frame.on("pointerdown", () => {
        if (!slot || !isSelectable) return;
        this.previewController.start((container) => {
          const cardW = UI_LAYOUT.slot.preview.cardWidth;
          const cardH = cardW * UI_LAYOUT.slot.preview.cardAspect;
          renderSlotPreviewCard({ scene: this.scene, container, slot, x: 0, y: 0, w: cardW, h: cardH, depthOffset: 0 });
        });
      });
      frame.on("pointerup", () => {
        if (this.previewController.isActive()) return;
        this.previewController.cancelPending();
        if (!slot || !isSelectable) return;
        toggleSelected(slot);
        updateUi();
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

      const frameW = cardW + framePadding + frameExtra.w;
      const frameH = cardH + framePadding + frameExtra.h;
      const tickRadius = 10;
      const tickX = x + frameW / 2 - tickRadius - 6;
      const tickY = frameY + frameH / 2 - tickRadius - 10;
      const tickBg = this.scene.add.circle(tickX, tickY, tickRadius, 0x2ecc71, 0.95);
      const tickLabel = this.scene.add
        .text(tickX, tickY + 0.5, "✓", { fontSize: "14px", fontFamily: "Arial", color: "#0b1b10" })
        .setOrigin(0.5);
      tickBg.setVisible(false);
      tickLabel.setVisible(false);
      ticks.push({ bg: tickBg, label: tickLabel });
      content.add([tickBg, tickLabel]);
    }

    if (!targets.length) {
      const empty = this.scene.add
        .text(0, gridTopY + gridVisibleHeight / 2, "No units available", {
          fontSize: "15px",
          fontFamily: "Arial",
          color: "#d7d9dd",
          align: "center",
        })
        .setOrigin(0.5);
      dialog.add(empty);
      setConfirmEnabled(false);
    }

    if (useScroll) {
      const scrollBounds = {
        x: -dialogWidth / 2 + margin,
        y: gridTopY,
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

    updateUi();
    dialog.setDepth(this.cfg.z.dialog);
    this.scene.add.existing(dialog);
    this.open = true;
  }
}
