import Phaser from "phaser";
import type { SlotViewModel, SlotCardView } from "./SlotTypes";

export type PilotTargetDialogShowOpts = {
  targets: SlotViewModel[];
  onSelect: (slot: SlotViewModel) => Promise<void> | void;
  header?: string;
  allowPiloted?: boolean;
  closeOnBackdrop?: boolean;
  showCloseButton?: boolean;
  onClose?: () => void;
};

export class PilotTargetDialog {
  private overlay?: Phaser.GameObjects.Rectangle;
  private dialog?: Phaser.GameObjects.Container;
  private open = false;
  private lastTargets: SlotViewModel[] = [];
  private lastOnSelect?: (slot: SlotViewModel) => Promise<void> | void;
  private lastOnClose?: (() => void) | undefined;
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
  ) {}

  async hide(): Promise<void> {
    console.log("hide PilotTargetDialog.ts");
    this.overlay?.destroy();
    this.dialog?.destroy();
    this.overlay = undefined;
    this.dialog = undefined;
    this.lastTargets = [];
    this.lastOnSelect = undefined;
    const onClose = this.lastOnClose;
    this.lastOnClose = undefined;
    this.open = false;
    onClose?.();
  }

  isOpen() {
    return this.open;
  }

  show(opts: PilotTargetDialogShowOpts) {
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
    const dialogHeight = Math.max(minHeight, gridHeight + extraHeight);

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
    const startY = -dialogHeight / 2 + headerOffset + 40 + cellHeight / 2;

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
      frame.setStrokeStyle(this.cfg.card.frameStroke, this.cfg.card.frameColor, 0.95);
      frame.setInteractive({ useHandCursor: !!slot?.unit });
      frame.on("pointerup", async () => {
        if (!slot?.unit) return;
        await opts.onSelect(slot);
        await this.hide();
      });
      dialog.add(frame);

      const slotSprite = slot ? this.createSlotSprite?.(slot, { w: cardW, h: cardH }) : undefined;
      if (slotSprite) {
        slotSprite.setPosition(x, y);
        dialog.add(slotSprite);
      } else {
        this.drawPreviewLike(dialog, slot, x, y, cardW, cardH);
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
    dialog.setDepth(2600);
    this.scene.add.existing(dialog);
    this.open = true;
  }

  async selectTarget(index = 0): Promise<boolean> {
    const target = this.lastTargets[index];
    if (!this.open || !target || !this.lastOnSelect) return false;
    await this.lastOnSelect(target);
    return true;
  }

  private toTex(tex?: string) {
    //return tex ? tex.replace(/-preview$/, "") : undefined;
    return tex
  }

  private getPilotBadge(card?: SlotCardView) {
    const type = (card?.cardType || card?.cardData?.cardType || "").toLowerCase();
    if (type === "command") {
      const rules: any[] = card?.cardData?.effects?.rules || [];
      const pilotRule = rules.find((r) => r?.effectId === "pilot_designation" || r?.effectId === "pilotDesignation");
      const apVal = pilotRule?.parameters?.AP ?? pilotRule?.parameters?.ap ?? 0;
      const hpVal = pilotRule?.parameters?.HP ?? pilotRule?.parameters?.hp ?? 0;
      return `${apVal}|${hpVal}`;
    }
    const apVal = card?.cardData?.ap ?? 0;
    const hpVal = card?.cardData?.hp ?? 0;
    return `${apVal}|${hpVal}`;
  }

  private getUnitBadge(card?: SlotCardView) {
    const apVal = card?.cardData?.ap ?? 0;
    const hpVal = card?.cardData?.hp ?? 0;
    return `${apVal}|${hpVal}`;
  }

  // Mirrors drawPreviewCard layout for pilot/unit/total badges.
  private drawPreviewLike(
    dialog: Phaser.GameObjects.Container,
    slot: SlotViewModel | undefined,
    x: number,
    y: number,
    cardW: number,
    cardH: number,
  ) {
    if (!slot) return;
    const badgeW = this.cfg.badges.size.w;
    const badgeH = this.cfg.badges.size.h;
    const totalGap = this.cfg.badges.totalGap;
    const pilotOffsetRatio = this.cfg.badges.pilotOffsetRatio;
    const pilotCommandOffsetRatio = this.cfg.badges.pilotCommandOffsetRatio;
    const pilotCommandLift = this.cfg.badges.pilotCommandLift;
    const unitYOffsetFactor = this.cfg.badges.unitYOffsetFactor;

    let pilotOffsetY = cardH * pilotOffsetRatio;
    if ((slot.pilot?.cardType || "").toLowerCase() === "command") {
      pilotOffsetY = cardH * pilotCommandOffsetRatio;
    }

    let slotCardEnd = -1;

    // Pilot layer
    if (slot.pilot) {
      const pilotTex = this.toTex(slot.pilot.textureKey);
      const pilotImg =
        pilotTex && this.scene.textures.exists(pilotTex)
          ? this.scene.add.image(x, y + pilotOffsetY, pilotTex).setDisplaySize(cardW, cardH).setOrigin(0.5)
          : this.scene.add.rectangle(x, y + pilotOffsetY, cardW, cardH, 0xcbd3df, 1).setOrigin(0.5);
      dialog.add(pilotImg);

      let badgeY = y + pilotOffsetY + cardH / 2 - badgeH / 2;
      if ((slot.pilot.cardType || "").toLowerCase() !== "command") {
        badgeY -= pilotCommandLift;
      }
      const pilotBadgeRect = this.scene.add.rectangle(x + cardW / 2 - badgeW / 2, badgeY, badgeW, badgeH, 0x000000, 0.9);
      const pilotBadgeText = this.scene.add.text(pilotBadgeRect.x, pilotBadgeRect.y, this.getPilotBadge(slot.pilot), {
        fontSize: `${this.cfg.badges.pilotFontSize}px`,
        fontFamily: "Arial",
        color: "#ffffff",
        fontStyle: "bold",
      }).setOrigin(0.5);
      dialog.add(pilotBadgeRect);
      dialog.add(pilotBadgeText);
      slotCardEnd = badgeY;
      if ((slot.pilot.cardType || "").toLowerCase() !== "command") {
        slotCardEnd += pilotCommandLift;
      }
    }

    // Unit layer
    if (slot.unit) {
      const unitTex = this.toTex(slot.unit.textureKey);
      const unitImg =
        unitTex && this.scene.textures.exists(unitTex)
          ? this.scene.add.image(x, y + pilotOffsetY * unitYOffsetFactor, unitTex).setDisplaySize(cardW, cardH).setOrigin(0.5)
          : this.scene.add.rectangle(x, y + pilotOffsetY * unitYOffsetFactor, cardW, cardH, 0xcbd3df, 0.9).setOrigin(0.5);
      dialog.add(unitImg);

      const unitBadgeRect = this.scene.add.rectangle(
        x + cardW / 2 - badgeW / 2,
        y - pilotOffsetY * 0.4 + cardH / 2 - badgeH / 2,
        badgeW,
        badgeH,
        0x000000,
        0.9,
      );
      const unitBadgeText = this.scene.add.text(unitBadgeRect.x, unitBadgeRect.y, this.getUnitBadge(slot.unit), {
        fontSize: `${this.cfg.badges.fontSize}px`,
        fontFamily: "Arial",
        color: "#ffffff",
        fontStyle: "bold",
      }).setOrigin(0.5);
      dialog.add(unitBadgeRect);
      dialog.add(unitBadgeText);

      if (slotCardEnd === -1) {
        slotCardEnd = y + pilotOffsetY * unitYOffsetFactor + cardH / 2 - badgeH / 2;
      }

      if (slot.fieldCardValue) {
        const totalRect = this.scene.add.rectangle(
          x + cardW / 2 - badgeW / 2,
          slotCardEnd + badgeH + totalGap,
          badgeW,
          badgeH,
          0x284cfc,
          0.95,
        );
          const totalText = this.scene.add.text(totalRect.x, totalRect.y, `${slot.fieldCardValue.totalAP ?? 0}|${slot.fieldCardValue.totalHP ?? 0}`, {
            fontSize: `${this.cfg.badges.fontSize}px`,
            fontFamily: "Arial",
            color: "#ffffff",
            fontStyle: "bold",
          }).setOrigin(0.5);
        dialog.add(totalRect);
        dialog.add(totalText);
      }
    }
  }
}
