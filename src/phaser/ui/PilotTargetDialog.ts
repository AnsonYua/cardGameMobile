import Phaser from "phaser";
import type { SlotViewModel, SlotCardView } from "./SlotTypes";

type ShowOpts = {
  targets: SlotViewModel[];
  onSelect: (slot: SlotViewModel) => Promise<void> | void;
};

export class PilotTargetDialog {
  private overlay?: Phaser.GameObjects.Rectangle;
  private dialog?: Phaser.GameObjects.Container;

  constructor(private scene: Phaser.Scene) {}

  hide() {
    this.overlay?.destroy();
    this.dialog?.destroy();
    this.overlay = undefined;
    this.dialog = undefined;
  }

  show(opts: ShowOpts) {
    this.hide();
    const cam = this.scene.cameras.main;
    const targets = opts.targets.slice(0, 6);
    const cols = 3;
    const rows = 2;
    const margin = 28;
    const gap = 16;
    const dialogWidth = Math.max(360, cam.width * 0.75);
    const cellWidth = (dialogWidth - margin * 2 - gap * (cols - 1)) / cols;
    const cardAspect = 88 / 64;
    const cardHeight = cellWidth * cardAspect;
    const cellHeight = cardHeight + 20;
    const gridHeight = rows * cellHeight + (rows - 1) * gap;
    const dialogHeight = Math.max(260, gridHeight + 120);

    this.overlay = this.scene.add
      .rectangle(cam.centerX, cam.centerY, cam.width, cam.height, 0x000000, 0.45)
      .setInteractive({ useHandCursor: true })
      .setDepth(2599);
    this.overlay.on("pointerup", () => this.hide());

    const dialog = this.scene.add.container(cam.centerX, cam.centerY);
    this.dialog = dialog;

    const panel = this.scene.add.graphics({ x: 0, y: 0 });
    panel.fillStyle(0x3a3d42, 0.95);
    panel.fillRoundedRect(-dialogWidth / 2, -dialogHeight / 2, dialogWidth, dialogHeight, 18);
    panel.lineStyle(2, 0x5b6068, 1);
    panel.strokeRoundedRect(-dialogWidth / 2, -dialogHeight / 2, dialogWidth, dialogHeight, 18);
    dialog.add(panel);

    const closeSize = 22;
    const closeButton = this.scene.add.rectangle(
      dialogWidth / 2 - closeSize - 12,
      -dialogHeight / 2 + closeSize + 12,
      closeSize,
      closeSize,
      0xffffff,
      0.12,
    );
    closeButton.setStrokeStyle(2, 0xffffff, 0.5);
    closeButton.setInteractive({ useHandCursor: true });
    closeButton.on("pointerup", () => this.hide());
    const closeLabel = this.scene.add
      .text(closeButton.x, closeButton.y, "✕", { fontSize: "15px", fontFamily: "Arial", color: "#f5f6f7", align: "center" })
      .setOrigin(0.5);

    const header = this.scene.add.text(0, -dialogHeight / 2 + 38, "Choose a Unit", {
      fontSize: "20px",
      fontFamily: "Arial",
      fontStyle: "bold",
      color: "#f5f6f7",
      align: "center",
      wordWrap: { width: dialogWidth - 80 },
    }).setOrigin(0.5);

    const startX = -dialogWidth / 2 + margin + cellWidth / 2;
    const startY = -dialogHeight / 2 + 70 + cellHeight / 2;

    const maxCells = cols * rows;
    for (let i = 0; i < maxCells; i++) {
      const slot = targets[i];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (cellWidth + gap);
      const y = startY + row * (cellHeight + gap);
      const cardW = cellWidth * 0.9;
      const cardH = cardW * cardAspect;

      const frame = this.scene.add.rectangle(x, y, cardW + 12, cardH + 12, 0x1b1e24, 0.75);
      frame.setStrokeStyle(3, 0x4caf50, 0.9);
      frame.setInteractive({ useHandCursor: !!slot?.unit });
      frame.on("pointerup", async () => {
        if (!slot?.unit) return;
        await opts.onSelect(slot);
        this.hide();
      });
      dialog.add(frame);

      this.drawPreviewLike(dialog, slot, x, y, cardW, cardH);
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

    dialog.add([closeButton, closeLabel, header]);
    dialog.setDepth(2600);
    this.scene.add.existing(dialog);
  }

  private toTex(tex?: string) {
    return tex ? tex.replace(/-preview$/, "") : undefined;
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
    const badgeW = 70;
    const badgeH = 45;
    const totalGap = 10;
    const pilotOffsetRatio = 0.2;
    const pilotCommandOffsetRatio = 0.1;
    const pilotCommandLift = 65;
    const unitYOffsetFactor = -0.4;

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
        fontSize: "16px",
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
        fontSize: "16px",
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
          fontSize: "16px",
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
