import Phaser from "phaser";
import type { SlotCardView, SlotViewModel } from "./SlotTypes";
import type { DrawHelpers } from "./HeaderHandler";
import { drawPreviewBadge } from "./PreviewBadge";
import { UI_LAYOUT } from "./UiLayoutConfig";

type SlotPreviewRenderOpts = {
  scene: Phaser.Scene;
  drawHelpers?: DrawHelpers;
  container: Phaser.GameObjects.Container;
  slot: SlotViewModel;
  x: number;
  y: number;
  w: number;
  h: number;
  depthOffset?: number;
};

export function renderSlotPreviewCard(opts: SlotPreviewRenderOpts) {
  const { scene, drawHelpers, container, slot, x, y, w, h, depthOffset = 0 } = opts;
  const cfg = UI_LAYOUT.slot.preview;
  const badgeW = cfg.badgeSize.w;
  const badgeH = cfg.badgeSize.h;

  let pilotOffsetY = h * cfg.pilotOffsetRatio;
  if ((slot.pilot?.cardType || "").toLowerCase() === "command") {
    pilotOffsetY = h * cfg.pilotCommandOffsetRatio;
  }

  let slotCardEnd = -1;

  if (slot.pilot) {
    const pilotTex = toTextureKey(slot.pilot);
    const pilotImg =
      pilotTex && scene.textures.exists(pilotTex)
        ? scene.add.image(x, y + pilotOffsetY, pilotTex).setDisplaySize(w, h).setOrigin(0.5)
        : drawFallbackCard(scene, drawHelpers, x, y + pilotOffsetY, w, h, 0xcbd3df, 1);
    pilotImg.setDepth(depthOffset + 1);
    container.add(pilotImg);

    const pilotLabel = getPilotBadgeLabel(slot.pilot);
    let badgeY = y + pilotOffsetY + h / 2 - badgeH / 2;
    if ((slot.pilot.cardType || "").toLowerCase() !== "command") {
      badgeY -= cfg.pilotCommandLift;
    }
    drawPreviewBadge({
      container,
      drawHelpers,
      x: x + w / 2 - badgeW / 2,
      y: badgeY,
      width: badgeW,
      height: badgeH,
      label: pilotLabel,
      baseDepth: depthOffset + 2,
      fillColor: 0x000000,
      fillAlpha: 1,
      radius: 6,
      widthPad: 5,
      depthPillOffset: 3,
      depthTextOffset: 4,
      textStyle: {
        fontSize: `${cfg.badgeFontSize}px`,
        fontFamily: "Arial",
        fontStyle: "bold",
        color: "#ffffff",
      },
    });
    slotCardEnd = badgeY;
    if ((slot.pilot.cardType || "").toLowerCase() !== "command") {
      slotCardEnd += cfg.pilotCommandLift;
    }
  }

  if (slot.unit) {
    const unitTex = toTextureKey(slot.unit);
    const unitImg =
      unitTex && scene.textures.exists(unitTex)
        ? scene.add.image(x, y + pilotOffsetY * cfg.unitYOffsetFactor, unitTex).setDisplaySize(w, h).setOrigin(0.5)
        : drawFallbackCard(scene, drawHelpers, x, y + pilotOffsetY * cfg.unitYOffsetFactor, w, h, 0xcbd3df, 0.9);
    unitImg.setDepth(depthOffset + 2);
    container.add(unitImg);

    const unitLabel = getUnitBadgeLabel(slot.unit);
    drawPreviewBadge({
      container,
      drawHelpers,
      x: x + w / 2 - badgeW / 2,
      y: y - pilotOffsetY * 0.4 + h / 2 - badgeH / 2,
      width: badgeW,
      height: badgeH,
      label: unitLabel,
      baseDepth: depthOffset + 3,
      fillColor: 0x000000,
      fillAlpha: 1,
      radius: 6,
      widthPad: 5,
      depthPillOffset: 3,
      depthTextOffset: 4,
      textStyle: {
        fontSize: `${cfg.badgeFontSize}px`,
        fontFamily: "Arial",
        fontStyle: "bold",
        color: "#ffffff",
      },
    });

    if (slotCardEnd === -1) {
      slotCardEnd = y + pilotOffsetY * cfg.unitYOffsetFactor + h / 2 - badgeH / 2;
    }

    if (slot.fieldCardValue) {
      const totalAp = slot.fieldCardValue.totalAP ?? 0;
      const totalHp = slot.fieldCardValue.totalHP ?? 0;
      drawPreviewBadge({
        container,
        drawHelpers,
        x: x + w / 2 - badgeW / 2,
        y: slotCardEnd + badgeH + cfg.totalBadgeGap,
        width: badgeW,
        height: badgeH,
        label: `${totalAp}|${totalHp}`,
        baseDepth: depthOffset + 3,
        fillColor: cfg.totalBadgeColor,
        fillAlpha: 1,
        radius: 6,
        widthPad: 5,
        depthPillOffset: 3,
        depthTextOffset: 4,
        textStyle: {
          fontSize: `${cfg.badgeFontSize}px`,
          fontFamily: "Arial",
          fontStyle: "bold",
          color: "#ffffff",
        },
      });
    }
  }
}

function drawFallbackCard(
  scene: Phaser.Scene,
  drawHelpers: DrawHelpers | undefined,
  x: number,
  y: number,
  w: number,
  h: number,
  fillColor: number,
  fillAlpha: number,
) {
  if (drawHelpers) {
    return drawHelpers.drawRoundedRect({
      x,
      y,
      width: w,
      height: h,
      radius: 12,
      fillColor,
      fillAlpha,
      strokeColor: "#0f1118",
      strokeAlpha: 0.8,
      strokeWidth: 2,
    });
  }
  return scene.add.rectangle(x, y, w, h, fillColor, fillAlpha).setOrigin(0.5);
}

function toTextureKey(card?: SlotCardView) {
  if (!card?.textureKey) return undefined;
  return card.textureKey.replaceAll("-preview", "");
}

function getUnitBadgeLabel(card: SlotCardView) {
  const ap = card.cardData?.ap ?? 0;
  const hp = card.cardData?.hp ?? 0;
  return `${ap}|${hp}`;
}

function getPilotBadgeLabel(card: SlotCardView) {
  const type = (card.cardType || card.cardData?.cardType || "").toLowerCase();
  if (type === "command") {
    const rules: any[] = card.cardData?.effects?.rules || [];
    const pilotRule = rules.find((r) => r?.effectId === "pilot_designation" || r?.effectId === "pilotDesignation");
    const ap = pilotRule?.parameters?.AP ?? pilotRule?.parameters?.ap ?? 0;
    const hp = pilotRule?.parameters?.HP ?? pilotRule?.parameters?.hp ?? 0;
    return `${ap}|${hp}`;
  }
  const ap = card.cardData?.ap ?? 0;
  const hp = card.cardData?.hp ?? 0;
  return `${ap}|${hp}`;
}
