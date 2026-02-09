import type Phaser from "phaser";

export type DialogBadgeTypeKey = "unit" | "pilot" | "base" | "command" | "pilotCommand" | "default";

type CardLike = {
  cardType?: string;
  fromPilotDesignation?: boolean;
  cardData?: { cardType?: string; effects?: { rules?: any[] } };
};

export function resolveDialogTextureKey(scene: Phaser.Scene, textureKey?: string) {
  if (!textureKey) return undefined;
  const key = String(textureKey);
  const baseKey = key.replace(/-preview$/i, "");
  const previewKey = key.toLowerCase().endsWith("-preview") ? key : `${key}-preview`;

  // Prefer preview textures (same as trash grid), then fall back to the base key.
  if (previewKey && scene.textures.exists(previewKey)) return previewKey;
  if (scene.textures.exists(key)) return key;
  if (baseKey && scene.textures.exists(baseKey)) return baseKey;
  return undefined;
}

export function getDialogBadgeTypeKey(card: CardLike): DialogBadgeTypeKey {
  const type = (card?.cardType || card?.cardData?.cardType || "").toLowerCase();
  if (type === "command" && isPilotCommand(card)) return "pilotCommand";
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

export function isPilotCommand(card: CardLike) {
  const type = (card?.cardType || card?.cardData?.cardType || "").toLowerCase();
  if (type !== "command") return false;
  if (card?.fromPilotDesignation) return true;
  const rules: any[] = card?.cardData?.effects?.rules || [];
  return rules.some(
    (rule) =>
      rule?.effectId === "pilot_designation" ||
      rule?.effectId === "pilotDesignation" ||
      rule?.action === "designate_pilot",
  );
}

