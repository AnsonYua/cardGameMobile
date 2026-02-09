import Phaser from "phaser";
import type { SlotCardView, SlotViewModel } from "./SlotTypes";
import { DEFAULT_CARD_DIALOG_CONFIG } from "./CardDialogLayout";

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

  // Target selection from zones like trash always represents a single card. Render it like the
  // trash dialog grid: one centered image + one stat badge. Only fall back to the stacked
  // unit/pilot layout when both are present.
  const hasUnit = !!slot.unit;
  const hasPilot = !!slot.pilot;
  if ((hasUnit && !hasPilot) || (!hasUnit && hasPilot)) {
    const card = slot.unit ?? slot.pilot;
    if (!card) return;
    const tex = resolveTextureKey(scene, card.textureKey);
    const scale = 0.9;
    const w = cardW * scale;
    const h = cardH * scale;
    const img = tex
      ? scene.add.image(x, y, tex).setDisplaySize(w, h).setOrigin(0.5)
      : scene.add.rectangle(x, y, w, h, 0xcbd3df, 0.9).setOrigin(0.5);

    const apVal = slot.fieldCardValue?.totalAP ?? card.cardData?.ap ?? 0;
    const hpVal = slot.fieldCardValue?.totalHP ?? card.cardData?.hp ?? 0;
    const label = `${Number(apVal) || 0}|${Number(hpVal) || 0}`;
    const typeKey = getTrashStyleBadgeTypeKey(card);
    const override = getTrashStyleBadgeOverride(typeKey);
    const offset = getTrashStyleBadgeOffset(typeKey);
    const badgeRect = scene.add.rectangle(
      x + w / 2 - override.size.w / 2 - override.insetX + offset.x,
      y + h / 2 - override.size.h / 2 - override.insetY + offset.y,
      override.size.w,
      override.size.h,
      DEFAULT_CARD_DIALOG_CONFIG.badge.fill,
      DEFAULT_CARD_DIALOG_CONFIG.badge.alpha,
    );
    const badgeText = scene.add.text(badgeRect.x, badgeRect.y, label, {
      fontSize: `${override.fontSize ?? badges.fontSize}px`,
      fontFamily: "Arial",
      color: "#ffffff",
      fontStyle: "bold",
    }).setOrigin(0.5);

    container.add(img);
    container.add(badgeRect);
    container.add(badgeText);
    return;
  }

  let pilotOffsetY = cardH * badges.pilotOffsetRatio;
  if ((slot.pilot?.cardType || "").toLowerCase() === "command") {
    pilotOffsetY = cardH * badges.pilotCommandOffsetRatio;
  }

  let slotCardEnd = -1;

  if (slot.pilot) {
    const pilotTex = resolveTextureKey(scene, slot.pilot.textureKey);
    const pilotImg = pilotTex
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
    const unitTex = resolveTextureKey(scene, slot.unit.textureKey);
    const unitImg = unitTex
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

function resolveTextureKey(scene: Phaser.Scene, textureKey?: string) {
  if (!textureKey) return undefined;
  const baseKey = textureKey.replace(/-preview$/i, "");
  // Target dialogs should prefer the same assets as trash grid rendering (preview textures),
  // falling back to the base key when previews aren't available.
  if (scene.textures.exists(textureKey)) return textureKey;
  if (baseKey && scene.textures.exists(baseKey)) return baseKey;
  return undefined;
}

function getTrashStyleBadgeTypeKey(card: SlotCardView): "unit" | "pilot" | "base" | "command" | "pilotCommand" | "default" {
  const type = (card?.cardType || card?.cardData?.cardType || "").toLowerCase();
  if (type === "command" && isPilotCommand(card)) return "pilotCommand";
  if (type === "unit") return "unit";
  if (type === "pilot") return "pilot";
  if (type === "base") return "base";
  if (type === "command") return "command";
  return "default";
}

function getTrashStyleBadgeOffset(typeKey: ReturnType<typeof getTrashStyleBadgeTypeKey>) {
  const offsets = DEFAULT_CARD_DIALOG_CONFIG.badge.offsets;
  if (typeKey === "pilotCommand") return offsets.pilotCommand;
  if (typeKey === "unit") return offsets.unit;
  if (typeKey === "pilot") return offsets.pilot;
  if (typeKey === "base") return offsets.base;
  if (typeKey === "command") return offsets.command;
  return offsets.default;
}

function getTrashStyleBadgeOverride(typeKey: ReturnType<typeof getTrashStyleBadgeTypeKey>) {
  const overrides = DEFAULT_CARD_DIALOG_CONFIG.cardTypeOverrides;
  if (typeKey === "unit") return overrides.unit;
  if (typeKey === "pilot") return overrides.pilot;
  if (typeKey === "base") return overrides.base;
  if (typeKey === "pilotCommand") return overrides.pilotCommand;
  return overrides.default;
}

function isPilotCommand(card: SlotCardView) {
  const type = (card?.cardType || card?.cardData?.cardType || "").toLowerCase();
  if (type !== "command") return false;
  const raw: any = card as any;
  if (raw?.fromPilotDesignation) return true;
  const rules: any[] = card?.cardData?.effects?.rules || [];
  return rules.some(
    (rule) =>
      rule?.effectId === "pilot_designation" ||
      rule?.effectId === "pilotDesignation" ||
      rule?.action === "designate_pilot",
  );
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
