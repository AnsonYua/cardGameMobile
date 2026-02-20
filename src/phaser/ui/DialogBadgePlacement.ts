import type { DialogBadgeTypeKey } from "./DialogCardRenderUtils";

export type DialogBadgePlacementMode = "dialog" | "preview";

export type ComputeDialogStatBadgePlacementInput = {
  cardTypeKey: DialogBadgeTypeKey;
  centerX: number;
  centerY: number;
  cardW: number;
  cardH: number;
  badgeW: number;
  badgeH: number;
  insetX?: number;
  insetY?: number;
  offsetX?: number;
  offsetY?: number;
  neutralInsetX?: number;
  neutralInsetY?: number;
  neutralOffsetX?: number;
  neutralOffsetY?: number;
  mode?: DialogBadgePlacementMode;
  scale?: number;
};

type LiftRatios = Record<DialogBadgeTypeKey, number>;

const PREVIEW_LIFT_RATIOS: LiftRatios = {
  default: 0,
  unit: 0,
  base: 0,
  command: 0.014,
  pilotCommand: 0.014,
  pilot: 0.16,
};

const DIALOG_LIFT_RATIOS: LiftRatios = {
  default: 0,
  unit: 0,
  base: 0,
  command: 0.014,
  pilotCommand: 0.014,
  pilot: 0.16,
};

export function computeDialogStatBadgePlacement(input: ComputeDialogStatBadgePlacementInput) {
  const mode = input.mode ?? "dialog";
  const ratios = mode === "preview" ? PREVIEW_LIFT_RATIOS : DIALOG_LIFT_RATIOS;
  const rawScale = Number.isFinite(input.scale) ? Number(input.scale) : 1;
  const scale = Math.max(0.5, rawScale);
  const isPilotType = input.cardTypeKey === "pilot" || input.cardTypeKey === "pilotCommand";

  const insetX = isPilotType ? (input.neutralInsetX ?? input.insetX ?? 0) : (input.insetX ?? 0);
  const insetY = isPilotType ? (input.neutralInsetY ?? input.insetY ?? 0) : (input.insetY ?? 0);
  const offsetX = isPilotType ? (input.neutralOffsetX ?? input.offsetX ?? 0) : (input.offsetX ?? 0);
  const offsetY = isPilotType ? (input.neutralOffsetY ?? input.offsetY ?? 0) : (input.offsetY ?? 0);

  const x = input.centerX + input.cardW / 2 - input.badgeW / 2 - insetX + offsetX;
  const lift = input.cardH * ratios[input.cardTypeKey] * scale;
  const y = input.centerY + input.cardH / 2 - input.badgeH / 2 - insetY + offsetY - lift;

  return { x, y };
}
