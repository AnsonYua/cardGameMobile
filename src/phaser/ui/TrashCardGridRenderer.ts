import Phaser from "phaser";
import { toPreviewKey, type HandCardView } from "./HandTypes";
import {
  getDialogBadgeOffset,
  getDialogBadgeOverride,
  getDialogBadgeTypeKey,
  isPilotCommand,
  resolveDialogTextureKey,
} from "./DialogCardRenderUtils";
import { computeDialogStatBadgePlacement } from "./DialogBadgePlacement";

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
  isCardInteractive?: (card: any) => boolean;
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
      isCardInteractive,
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
        const interactive = isCardInteractive ? isCardInteractive(card) !== false : true;
        if (interactive) {
          frame.setInteractive({ useHandCursor: true });
          frame.on("pointerdown", () => onPointerDown?.(card));
          frame.on("pointerup", () => onPointerUp?.(card));
          frame.on("pointerout", () => onPointerOut?.(card));
        }
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
        const typeKey = getDialogBadgeTypeKey(card);
        const override = getDialogBadgeOverride(typeOverrides, typeKey);
        const offset = getDialogBadgeOffset(badgeConfig, typeKey);
        const unitOverride = getDialogBadgeOverride(typeOverrides, "unit");
        const unitOffset = getDialogBadgeOffset(badgeConfig, "unit");
        const badgeW = override.size.w;
        const badgeH = override.size.h;
        const pos = computeDialogStatBadgePlacement({
          cardTypeKey: typeKey,
          centerX: x,
          centerY: y,
          cardW,
          cardH,
          badgeW,
          badgeH,
          insetX: override.insetX,
          insetY: override.insetY,
          offsetX: offset.x,
          offsetY: offset.y,
          neutralInsetX: unitOverride.insetX,
          neutralInsetY: unitOverride.insetY,
          neutralOffsetX: unitOffset.x,
          neutralOffsetY: unitOffset.y,
          mode: "dialog",
        });
        const badgeX = pos.x;
        const badgeY = pos.y;
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
    const preferPreview = card?.preferPreview !== false;
    const explicit = card?.textureKey;
    if (explicit) {
      return resolveDialogTextureKey(this.scene, String(explicit), { preferPreview });
    }
    const cardId = card?.cardId ?? card?.cardData?.id ?? card?.cardData?.cardId;
    if (cardId === "base" || cardId === "base_default") return "baseCard";
    return resolveDialogTextureKey(this.scene, toPreviewKey(cardId) || cardId, { preferPreview });
  }

  private getPreviewTexture(card: any) {
    // Preview popups should render the same texture used in the grid.
    return this.getCardTexture(card);
  }

  private getCardLabel(card: any) {
    return card?.cardData?.name || card?.cardId || "card";
  }

  private getStatLabel(card: any) {
    const type = (card?.cardType || card?.cardData?.cardType || "").toLowerCase();
    const pilotCommand = isPilotCommand(card);
    const shouldShow = ["unit", "pilot", "base"].includes(type) || pilotCommand;
    const ap = card?.fieldCardValue?.totalAP ?? card?.cardData?.ap ?? card?.ap;
    const hp = card?.fieldCardValue?.totalHP ?? card?.cardData?.hp ?? card?.hp;
    if (!shouldShow) return undefined;
    if (ap === undefined && hp === undefined) return undefined;
    return `${Number(ap ?? 0)}|${Number(hp ?? 0)}`;
  }

  private toPreviewCard(card: any): HandCardView {
    const cardId = card?.cardId;
    return {
      cardType: card?.cardType || card?.cardData?.cardType,
      fromPilotDesignation: card?.fromPilotDesignation,
      cardId,
      color: 0x2a2d38,
      textureKey: toPreviewKey(cardId),
    };
  }
}
