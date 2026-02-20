import type Phaser from "phaser";
import { resolveDialogTextureKey } from "../DialogCardRenderUtils";

export type ChoiceCardInteractionState = "read_only" | "selectable";

export type ChoiceCardPlateCard = {
  cardId?: string;
  label?: string;
  textureKey?: string;
};

export function getChoiceCardPlateVisual(state: ChoiceCardInteractionState, enabled = true) {
  if (!enabled) {
    return {
      plateFill: 0x13161b,
      plateAlpha: 0.9,
      border: 0x4b5059,
      borderAlpha: 0.55,
      footerFill: 0x0d1014,
      footerAlpha: 0.9,
      hint: "Unavailable",
      hintColor: "#8f96a3",
      interactive: false,
    };
  }
  if (state === "selectable") {
    return {
      plateFill: 0x1b1e24,
      plateAlpha: 0.92,
      border: 0x8ea8ff,
      borderAlpha: 1,
      footerFill: 0x0e1014,
      footerAlpha: 0.95,
      hint: "Tap card to select",
      hintColor: "#f5f6f7",
      interactive: true,
    };
  }
  return {
    plateFill: 0x1b1e24,
    plateAlpha: 0.9,
    border: 0x5b6068,
    borderAlpha: 0.8,
    footerFill: 0x0e1014,
    footerAlpha: 0.92,
    hint: "Review only",
    hintColor: "#c5c9d0",
    interactive: false,
  };
}

export function renderChoiceCardPlate(params: {
  scene: Phaser.Scene;
  container: Phaser.GameObjects.Container;
  x: number;
  y: number;
  cardWidth: number;
  cardHeight: number;
  card: ChoiceCardPlateCard;
  state: ChoiceCardInteractionState;
  enabled?: boolean;
  hintText?: string;
  interactive?: boolean;
  styles?: { footerHeight?: number; platePadding?: number };
  onSelect?: () => Promise<void> | void;
}) {
  const footerHeight = Math.max(18, Number(params.styles?.footerHeight ?? 22));
  const platePadding = Math.max(4, Number(params.styles?.platePadding ?? 7));
  const plateWidth = params.cardWidth + platePadding * 2;
  const plateHeight = params.cardHeight + footerHeight + platePadding * 2;
  const visual = getChoiceCardPlateVisual(params.state, params.enabled !== false);

  const plate = params.scene.add.rectangle(params.x, params.y, plateWidth, plateHeight, visual.plateFill, visual.plateAlpha);
  plate.setStrokeStyle(2, visual.border, visual.borderAlpha);

  const cardY = params.y - (footerHeight / 2);
  const footerY = params.y + plateHeight / 2 - footerHeight / 2 - platePadding;
  const footer = params.scene.add.rectangle(params.x, footerY, params.cardWidth, footerHeight, visual.footerFill, visual.footerAlpha);
  const hintText = (params.hintText ?? visual.hint).toString();
  const hint = params.scene
    .add.text(params.x, footerY, hintText, {
      fontSize: "12px",
      fontFamily: "Arial",
      fontStyle: "bold",
      color: visual.hintColor,
      align: "center",
      wordWrap: { width: params.cardWidth - 8 },
    })
    .setOrigin(0.5);

  const rawTextureKey = params.card.textureKey || params.card.cardId;
  const textureKey = rawTextureKey
    ? resolveDialogTextureKey(params.scene, rawTextureKey, { preferPreview: false })
    : undefined;

  if (textureKey && params.scene.textures.exists(textureKey)) {
    const img = params.scene.add.image(params.x, cardY, textureKey).setDisplaySize(params.cardWidth, params.cardHeight).setOrigin(0.5);
    params.container.add([plate, img, footer, hint]);
  } else {
    const fallback = params.scene.add.rectangle(params.x, cardY, params.cardWidth, params.cardHeight, 0xcbd3df, 0.9).setOrigin(0.5);
    const fallbackLabel = params.scene.add
      .text(params.x, cardY, params.card.label || params.card.cardId || "card", {
        fontSize: "12px",
        fontFamily: "Arial",
        color: "#0f1118",
        align: "center",
        wordWrap: { width: params.cardWidth - 10 },
      })
      .setOrigin(0.5);
    params.container.add([plate, fallback, fallbackLabel, footer, hint]);
  }

  const interactive = params.interactive ?? visual.interactive;
  if (interactive && params.onSelect) {
    plate.setInteractive({ useHandCursor: true });
    plate.on("pointerover", () => {
      plate.setStrokeStyle(2, 0xa9beff, 1);
    });
    plate.on("pointerout", () => {
      plate.setStrokeStyle(2, visual.border, visual.borderAlpha);
    });
    plate.on("pointerup", async () => {
      await params.onSelect?.();
    });
  }

  return { plate, footer, hint };
}
