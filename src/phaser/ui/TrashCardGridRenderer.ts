import Phaser from "phaser";
import { toPreviewKey, type HandCardView } from "./HandTypes";

export type TrashGridCardConfig = {
  aspect: number;
  widthFactor: number;
  framePadding: number;
  frameExtra: { w: number; h: number };
  frameStroke: number;
  frameColor: number;
  extraCellHeight: number;
};

export type TrashGridBadgeConfig = {
  size: { w: number; h: number };
  fontSize: number;
  insetX: number;
  insetY: number;
  fill: number;
  alpha: number;
  offsets: {
    default: { x: number; y: number };
    unit: { x: number; y: number };
    pilot: { x: number; y: number };
    base: { x: number; y: number };
    command: { x: number; y: number };
    pilotCommand: { x: number; y: number };
  };
};

export type TrashGridTypeOverrides = {
  unit: { size: { w: number; h: number }; fontSize: number; insetX: number; insetY: number };
  pilot: { size: { w: number; h: number }; fontSize: number; insetX: number; insetY: number };
  base: { size: { w: number; h: number }; fontSize: number; insetX: number; insetY: number };
  pilotCommand: { size: { w: number; h: number }; fontSize: number; insetX: number; insetY: number };
  default: { size: { w: number; h: number }; fontSize: number; insetX: number; insetY: number };
};

type RenderOpts = {
  container: Phaser.GameObjects.Container;
  cards: any[];
  cols: number;
  gap: number;
  startX: number;
  startY: number;
  cellWidth: number;
  cellHeight: number;
  cardConfig: TrashGridCardConfig;
  badgeConfig: TrashGridBadgeConfig;
  typeOverrides: TrashGridTypeOverrides;
  onPointerDown?: (card: any) => void;
  onPointerUp?: (card: any) => void;
  onPointerOut?: (card: any) => void;
};

export class TrashCardGridRenderer {
  constructor(private scene: Phaser.Scene) {}

  render(opts: RenderOpts) {
    const {
      container,
      cards,
      cols,
      gap,
      startX,
      startY,
      cellWidth,
      cellHeight,
      cardConfig,
      badgeConfig,
      typeOverrides,
      onPointerDown,
      onPointerUp,
      onPointerOut,
    } = opts;
    const totalRows = Math.max(1, Math.ceil(cards.length / cols));
    const contentHeight = totalRows * cellHeight + (totalRows - 1) * gap;

    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (cellWidth + gap);
      const y = startY + row * (cellHeight + gap);
      const cardW = cellWidth * cardConfig.widthFactor;
      const cardH = cardW * cardConfig.aspect;

      const frame = this.scene.add.rectangle(
        x,
        y,
        cardW + cardConfig.framePadding + cardConfig.frameExtra.w,
        cardH + cardConfig.framePadding + cardConfig.frameExtra.h,
        0x1b1e24,
        0.75,
      );
      frame.setStrokeStyle(cardConfig.frameStroke, cardConfig.frameColor, 0.95);
      if (onPointerDown || onPointerUp || onPointerOut) {
        frame.setInteractive({ useHandCursor: true });
        frame.on("pointerdown", () => onPointerDown?.(card));
        frame.on("pointerup", () => onPointerUp?.(card));
        frame.on("pointerout", () => onPointerOut?.(card));
      }
      container.add(frame);

      const texKey = this.getCardTexture(card);
      if (texKey && this.scene.textures.exists(texKey)) {
        const img = this.scene.add.image(x, y, texKey).setDisplaySize(cardW, cardH).setOrigin(0.5);
        container.add(img);
      } else {
        const fallback = this.scene.add.rectangle(x, y, cardW, cardH, 0xcbd3df, 0.9).setOrigin(0.5);
        container.add(fallback);
        const label = this.scene.add
          .text(x, y, this.getCardLabel(card), {
            fontSize: "12px",
            fontFamily: "Arial",
            color: "#0f1118",
            align: "center",
            wordWrap: { width: cardW - 10 },
          })
          .setOrigin(0.5);
        container.add(label);
      }

      const statLabel = this.getStatLabel(card);
      if (statLabel) {
        const typeKey = this.getBadgeTypeKey(card);
        const override = this.getBadgeOverride(typeOverrides, typeKey);
        const offset = this.getBadgeOffset(badgeConfig, typeKey);
        const badgeW = override.size.w;
        const badgeH = override.size.h;
        const badgeX = x + cardW / 2 - badgeW / 2 - override.insetX + offset.x;
        const badgeY = y + cardH / 2 - badgeH / 2 - override.insetY + offset.y;
        const badgeRect = this.scene.add.rectangle(badgeX, badgeY, badgeW, badgeH, badgeConfig.fill, badgeConfig.alpha);
        const badgeText = this.scene.add.text(badgeX, badgeY, statLabel, {
          fontSize: `${override.fontSize}px`,
          fontFamily: "Arial",
          color: "#ffffff",
          fontStyle: "bold",
        }).setOrigin(0.5);
        container.add(badgeRect);
        container.add(badgeText);
      }
    }

    return { totalRows, contentHeight };
  }

  getPreviewData(card: any) {
    return {
      textureKey: this.getPreviewTexture(card),
      statLabel: this.getStatLabel(card),
      previewCard: this.toPreviewCard(card),
    };
  }

  private getCardTexture(card: any) {
    const cardId = card?.cardId ?? card?.cardData?.id ?? card?.cardData?.cardId;
    if (cardId === "base" || cardId === "base_default") return "baseCard";
    return toPreviewKey(cardId) || cardId;
  }

  private getPreviewTexture(card: any) {
    const key = this.getCardTexture(card);
    return key ? key.replace(/-preview$/, "") : key;
  }

  private getCardLabel(card: any) {
    return card?.cardData?.name || card?.cardId || "card";
  }

  private getStatLabel(card: any) {
    const type = (card?.cardType || card?.cardData?.cardType || "").toLowerCase();
    const isPilotCommand = this.isPilotCommand(card, type);
    const shouldShow = ["unit", "pilot", "base"].includes(type) || isPilotCommand;
    const ap = card?.fieldCardValue?.totalAP ?? card?.cardData?.ap ?? card?.ap;
    const hp = card?.fieldCardValue?.totalHP ?? card?.cardData?.hp ?? card?.hp;
    if (!shouldShow) return undefined;
    if (ap === undefined && hp === undefined) return undefined;
    return `${Number(ap ?? 0)}|${Number(hp ?? 0)}`;
  }

  private getBadgeOffset(badgeConfig: TrashGridBadgeConfig, typeKey: ReturnType<typeof this.getBadgeTypeKey>) {
    if (typeKey === "pilotCommand") return badgeConfig.offsets.pilotCommand;
    if (typeKey === "unit") return badgeConfig.offsets.unit;
    if (typeKey === "pilot") return badgeConfig.offsets.pilot;
    if (typeKey === "base") return badgeConfig.offsets.base;
    if (typeKey === "command") return badgeConfig.offsets.command;
    return badgeConfig.offsets.default;
  }

  private getBadgeTypeKey(card: any): "unit" | "pilot" | "base" | "command" | "pilotCommand" | "default" {
    const type = (card?.cardType || card?.cardData?.cardType || "").toLowerCase();
    if (type === "command" && this.isPilotCommand(card, type)) return "pilotCommand";
    if (type === "unit") return "unit";
    if (type === "pilot") return "pilot";
    if (type === "base") return "base";
    if (type === "command") return "command";
    return "default";
  }

  private getBadgeOverride(typeOverrides: TrashGridTypeOverrides, typeKey: ReturnType<typeof this.getBadgeTypeKey>) {
    if (typeKey === "unit") return typeOverrides.unit;
    if (typeKey === "pilot") return typeOverrides.pilot;
    if (typeKey === "base") return typeOverrides.base;
    if (typeKey === "pilotCommand") return typeOverrides.pilotCommand;
    return typeOverrides.default;
  }

  private isPilotCommand(card: any, type?: string) {
    const normalized = type ?? (card?.cardType || card?.cardData?.cardType || "").toLowerCase();
    if (normalized !== "command") return false;
    if (card?.fromPilotDesignation) return true;
    const rules: any[] = card?.cardData?.effects?.rules || [];
    return rules.some((rule) => rule?.effectId === "pilot_designation" || rule?.effectId === "pilotDesignation" || rule?.action === "designate_pilot");
  }

  private toPreviewCard(card: any): HandCardView {
    return {
      cardType: card?.cardType || card?.cardData?.cardType,
      fromPilotDesignation: card?.fromPilotDesignation,
      cardId: card?.cardId,
    };
  }
}
