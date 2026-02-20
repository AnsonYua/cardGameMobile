import type { CardDialogConfig } from "./CardDialogLayout";

type BadgeBase = { size: { w: number; h: number }; fontSize: number; insetX: number; insetY: number };

function scaleBadgeBase<T extends BadgeBase>(cfg: T, scale: number): T {
  const s = Number.isFinite(scale) ? scale : 1;
  if (s === 1) return cfg;
  return {
    ...cfg,
    size: { w: cfg.size.w * s, h: cfg.size.h * s },
    fontSize: cfg.fontSize * s,
    insetX: cfg.insetX * s,
    insetY: cfg.insetY * s,
  };
}

function scaleOffsets(
  offsets: CardDialogConfig["badge"]["offsets"],
  scale: number,
): CardDialogConfig["badge"]["offsets"] {
  const s = Number.isFinite(scale) ? scale : 1;
  if (s === 1) return offsets;
  return Object.fromEntries(Object.entries(offsets).map(([k, v]) => [k, { x: v.x * s, y: v.y * s }])) as CardDialogConfig["badge"]["offsets"];
}

export function computePopupBadgeScale(cfg: CardDialogConfig, cols: number) {
  const baseCols = Math.max(1, cfg.dialog.cols);
  const safeCols = Math.max(1, cols);
  // Popups show only a few cards; when showing a single card, the cell (and card art) is much larger than in normal
  // dialogs (default cols=3), so scale the badge proportionally.
  return Math.min(2.8, Math.max(1.8, (baseCols / safeCols) * 0.9));
}

export function buildPopupBadgeConfigs(cfg: CardDialogConfig, cols: number) {
  const badgeScale = computePopupBadgeScale(cfg, cols);
  const badgeConfig: CardDialogConfig["badge"] = {
    ...scaleBadgeBase(cfg.badge, badgeScale),
    offsets: scaleOffsets(cfg.badge.offsets, badgeScale),
  };
  const typeOverrides: CardDialogConfig["cardTypeOverrides"] = {
    unit: scaleBadgeBase(cfg.cardTypeOverrides.unit, badgeScale),
    pilot: scaleBadgeBase(cfg.cardTypeOverrides.pilot, badgeScale),
    base: scaleBadgeBase(cfg.cardTypeOverrides.base, badgeScale),
    pilotCommand: scaleBadgeBase(cfg.cardTypeOverrides.pilotCommand, badgeScale),
    default: scaleBadgeBase(cfg.cardTypeOverrides.default, badgeScale),
  };
  return { badgeScale, badgeConfig, typeOverrides };
}
