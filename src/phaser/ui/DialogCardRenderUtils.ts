import type Phaser from "phaser";

export type DialogBadgeTypeKey = "unit" | "pilot" | "base" | "command" | "pilotCommand" | "default";

type CardLike = {
  cardType?: string;
  fromPilotDesignation?: boolean | string | number | null;
  cardData?: {
    cardType?: string;
    ap?: number;
    hp?: number;
    effects?: { rules?: any[] };
    fieldCardValue?: { totalAP?: number; totalHP?: number };
  };
  ap?: number;
  hp?: number;
  fieldCardValue?: { totalAP?: number; totalHP?: number };
};

export function resolveDialogTextureKey(
  scene: Phaser.Scene,
  textureKey?: string,
  opts: { preferPreview?: boolean } = {},
) {
  if (!textureKey) return undefined;
  const preferPreview = opts.preferPreview !== false;
  const key = String(textureKey);
  const baseKey = key.replace(/-preview$/i, "");
  const previewKey = key.toLowerCase().endsWith("-preview") ? key : `${key}-preview`;

  if (preferPreview) {
    // Prefer preview textures (same as trash grid), then fall back to the base key.
    if (previewKey && scene.textures.exists(previewKey)) return previewKey;
    if (scene.textures.exists(key)) return key;
    if (baseKey && scene.textures.exists(baseKey)) return baseKey;
    return undefined;
  }

  // Prefer full art when requested (used for reveal-style popups).
  if (scene.textures.exists(key)) return key;
  if (baseKey && scene.textures.exists(baseKey)) return baseKey;
  if (previewKey && scene.textures.exists(previewKey)) return previewKey;
  return undefined;
}

export function getDialogBadgeTypeKey(card: CardLike): DialogBadgeTypeKey {
  const type = (card?.cardType || card?.cardData?.cardType || "").toLowerCase();
  if (type === "command" && isStrictPilotDesignation(card)) return "pilotCommand";
  if (type === "unit") return "unit";
  if (type === "pilot") return "pilot";
  if (type === "base") return "base";
  if (type === "command") return "command";
  return "default";
}

export function getDialogBadgeOffset(
  badgeConfig: { offsets: Record<string, { x: number; y: number }> },
  typeKey: DialogBadgeTypeKey,
) {
  const offsets = badgeConfig.offsets as any;
  if (typeKey === "pilotCommand") return offsets.pilotCommand;
  if (typeKey === "unit") return offsets.unit;
  if (typeKey === "pilot") return offsets.pilot;
  if (typeKey === "base") return offsets.base;
  if (typeKey === "command") return offsets.command;
  return offsets.default;
}

export function getDialogBadgeOverride(
  typeOverrides: Record<string, { size: { w: number; h: number }; fontSize: number; insetX: number; insetY: number }>,
  typeKey: DialogBadgeTypeKey,
) {
  const overrides = typeOverrides as any;
  if (typeKey === "unit") return overrides.unit;
  if (typeKey === "pilot") return overrides.pilot;
  if (typeKey === "base") return overrides.base;
  if (typeKey === "pilotCommand") return overrides.pilotCommand;
  return overrides.default;
}

export function isStrictPilotDesignation(card: CardLike) {
  const type = (card?.cardType || card?.cardData?.cardType || "").toLowerCase();
  if (type !== "command") return false;
  if (card?.fromPilotDesignation === true) return true;
  const rules: any[] = card?.cardData?.effects?.rules || [];
  return rules.some(
    (rule) =>
      rule?.effectId === "pilot_designation" ||
      rule?.effectId === "pilotDesignation" ||
      rule?.action === "designate_pilot",
  );
}

export function isPilotCommand(card: CardLike) {
  return isStrictPilotDesignation(card);
}

export function shouldShowCardStatsBadge(card: CardLike) {
  const type = (card?.cardType || card?.cardData?.cardType || "").toLowerCase();
  if (type === "unit" || type === "pilot" || type === "base") return true;
  if (type === "command") return isStrictPilotDesignation(card);
  return false;
}

export function getCardStatsLabel(card: CardLike, opts: { ap?: unknown; hp?: unknown } = {}) {
  if (!shouldShowCardStatsBadge(card)) return undefined;
  const ap = opts.ap ?? card?.fieldCardValue?.totalAP ?? card?.cardData?.fieldCardValue?.totalAP ?? card?.cardData?.ap ?? card?.ap;
  const hp = opts.hp ?? card?.fieldCardValue?.totalHP ?? card?.cardData?.fieldCardValue?.totalHP ?? card?.cardData?.hp ?? card?.hp;
  if (ap === undefined && hp === undefined) return undefined;
  return `${Number(ap ?? 0)}|${Number(hp ?? 0)}`;
}
