import type Phaser from "phaser";
import { DEFAULT_CARD_DIALOG_CONFIG } from "./CardDialogLayout";
import type { SlotCardView, SlotViewModel } from "./SlotTypes";
import {
  getDialogBadgeOffset,
  getDialogBadgeOverride,
  getDialogBadgeTypeKey,
  resolveDialogTextureKey,
} from "./DialogCardRenderUtils";
import { computeDialogStatBadgePlacement } from "./DialogBadgePlacement";

export function renderSingleCardDialogSlot(opts: {
  scene: Phaser.Scene;
  container: Phaser.GameObjects.Container;
  slot: SlotViewModel;
  card: SlotCardView;
  x: number;
  y: number;
  cardW: number;
  cardH: number;
  scale?: number;
}) {
  const { scene, container, slot, card, x, y, cardW, cardH } = opts;
  const scale = Math.max(0.1, Math.min(1, opts.scale ?? 0.9));

  const tex = resolveDialogTextureKey(scene, card.textureKey);
  const w = cardW * scale;
  const h = cardH * scale;
  const img = tex
    ? scene.add.image(x, y, tex).setDisplaySize(w, h).setOrigin(0.5)
    : scene.add.rectangle(x, y, w, h, 0xcbd3df, 0.9).setOrigin(0.5);

  const apVal = slot.fieldCardValue?.totalAP ?? card.cardData?.ap ?? 0;
  const hpVal = slot.fieldCardValue?.totalHP ?? card.cardData?.hp ?? 0;
  const label = `${Number(apVal) || 0}|${Number(hpVal) || 0}`;

  const typeKey = getDialogBadgeTypeKey(card);
  const override = getDialogBadgeOverride(DEFAULT_CARD_DIALOG_CONFIG.cardTypeOverrides, typeKey);
  const offset = getDialogBadgeOffset(DEFAULT_CARD_DIALOG_CONFIG.badge, typeKey);
  const unitOverride = getDialogBadgeOverride(DEFAULT_CARD_DIALOG_CONFIG.cardTypeOverrides, "unit");
  const unitOffset = getDialogBadgeOffset(DEFAULT_CARD_DIALOG_CONFIG.badge, "unit");
  const pos = computeDialogStatBadgePlacement({
    cardTypeKey: typeKey,
    centerX: x,
    centerY: y,
    cardW: w,
    cardH: h,
    badgeW: override.size.w,
    badgeH: override.size.h,
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
  const badgeRect = scene.add.rectangle(
    pos.x,
    pos.y,
    override.size.w,
    override.size.h,
    DEFAULT_CARD_DIALOG_CONFIG.badge.fill,
    DEFAULT_CARD_DIALOG_CONFIG.badge.alpha,
  );
  const badgeText = scene.add.text(badgeRect.x, badgeRect.y, label, {
    fontSize: `${override.fontSize}px`,
    fontFamily: "Arial",
    color: "#ffffff",
    fontStyle: "bold",
  }).setOrigin(0.5);

  container.add(img);
  container.add(badgeRect);
  container.add(badgeText);
}
