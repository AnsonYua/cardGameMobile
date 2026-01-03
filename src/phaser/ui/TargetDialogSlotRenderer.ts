import Phaser from "phaser";
import type { SlotCardView, SlotViewModel } from "./SlotTypes";

export type TargetDialogBadgeConfig = {
  size: { w: number; h: number };
  totalGap: number;
  fontSize: number;
  pilotFontSize: number;
  pilotOffsetRatio: number;
  pilotCommandOffsetRatio: number;
  pilotCommandLift: number;
  unitYOffsetFactor: number;
};

type RenderTargetDialogSlotOpts = {
  scene: Phaser.Scene;
  container: Phaser.GameObjects.Container;
  slot: SlotViewModel | undefined;
  x: number;
  y: number;
  cardW: number;
  cardH: number;
  badges: TargetDialogBadgeConfig;
};

export function renderTargetDialogSlot(opts: RenderTargetDialogSlotOpts) {
  const { scene, container, slot, x, y, cardW, cardH, badges } = opts;
  if (!slot) return;
  const badgeW = badges.size.w;
  const badgeH = badges.size.h;

  let pilotOffsetY = cardH * badges.pilotOffsetRatio;
  if ((slot.pilot?.cardType || "").toLowerCase() === "command") {
    pilotOffsetY = cardH * badges.pilotCommandOffsetRatio;
  }

  let slotCardEnd = -1;

  if (slot.pilot) {
    const pilotTex = toTex(slot.pilot.textureKey);
    const pilotImg =
      pilotTex && scene.textures.exists(pilotTex)
        ? scene.add.image(x, y + pilotOffsetY, pilotTex).setDisplaySize(cardW, cardH).setOrigin(0.5)
        : scene.add.rectangle(x, y + pilotOffsetY, cardW, cardH, 0xcbd3df, 1).setOrigin(0.5);

    let badgeY = y + pilotOffsetY + cardH / 2 - badgeH / 2;
    if ((slot.pilot.cardType || "").toLowerCase() !== "command") {
      badgeY -= badges.pilotCommandLift;
    }
    const pilotBadgeRect = scene.add.rectangle(x + cardW / 2 - badgeW / 2, badgeY, badgeW, badgeH, 0x000000, 0.9);
    const pilotBadgeText = scene.add.text(pilotBadgeRect.x, pilotBadgeRect.y, getPilotBadge(slot.pilot), {
      fontSize: `${badges.pilotFontSize}px`,
      fontFamily: "Arial",
      color: "#ffffff",
      fontStyle: "bold",
    }).setOrigin(0.5);

    slotCardEnd = badgeY;
    if ((slot.pilot.cardType || "").toLowerCase() !== "command") {
      slotCardEnd += badges.pilotCommandLift;
    }

    // Add after computing to keep ordering consistent.
    container.add(pilotImg);
    container.add(pilotBadgeRect);
    container.add(pilotBadgeText);
  }

  if (slot.unit) {
    const unitTex = toTex(slot.unit.textureKey);
    const unitImg =
      unitTex && scene.textures.exists(unitTex)
        ? scene.add.image(x, y + pilotOffsetY * badges.unitYOffsetFactor, unitTex).setDisplaySize(cardW, cardH).setOrigin(0.5)
        : scene.add.rectangle(x, y + pilotOffsetY * badges.unitYOffsetFactor, cardW, cardH, 0xcbd3df, 0.9).setOrigin(0.5);

    const unitBadgeRect = scene.add.rectangle(
      x + cardW / 2 - badgeW / 2,
      y - pilotOffsetY * 0.4 + cardH / 2 - badgeH / 2,
      badgeW,
      badgeH,
      0x000000,
      0.9,
    );
    const unitBadgeText = scene.add.text(unitBadgeRect.x, unitBadgeRect.y, getUnitBadge(slot.unit), {
      fontSize: `${badges.fontSize}px`,
      fontFamily: "Arial",
      color: "#ffffff",
      fontStyle: "bold",
    }).setOrigin(0.5);

    if (slotCardEnd === -1) {
      slotCardEnd = y + pilotOffsetY * badges.unitYOffsetFactor + cardH / 2 - badgeH / 2;
    }

    container.add(unitImg);
    container.add(unitBadgeRect);
    container.add(unitBadgeText);

    if (slot.fieldCardValue) {
      const totalRect = scene.add.rectangle(
        x + cardW / 2 - badgeW / 2,
        slotCardEnd + badgeH + badges.totalGap,
        badgeW,
        badgeH,
        0x284cfc,
        0.95,
      );
      const totalText = scene.add.text(
        totalRect.x,
        totalRect.y,
        `${slot.fieldCardValue.totalAP ?? 0}|${slot.fieldCardValue.totalHP ?? 0}`,
        {
          fontSize: `${badges.fontSize}px`,
          fontFamily: "Arial",
          color: "#ffffff",
          fontStyle: "bold",
        },
      ).setOrigin(0.5);
      container.add(totalRect);
      container.add(totalText);
    }
  }
}

function toTex(tex?: string) {
  return tex;
}

function getPilotBadge(card?: SlotCardView) {
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

function getUnitBadge(card?: SlotCardView) {
  const apVal = card?.cardData?.ap ?? 0;
  const hpVal = card?.cardData?.hp ?? 0;
  return `${apVal}|${hpVal}`;
}
