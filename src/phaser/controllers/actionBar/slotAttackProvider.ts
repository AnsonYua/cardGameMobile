import type { ActionDescriptor } from "../../game/ActionRegistry";
import type { SlotViewModel } from "../../ui/SlotTypes";
import { buildSlotActionDescriptors, computeSlotActionState } from "../actionBarPolicy";
import { getAttackUnitTargets } from "../attackTargetPolicy";

function phaseAllowsAttack(raw?: any) {
  if (!raw) return false;
  const env = raw?.gameEnv ?? raw;
  const explicit =
    env?.phaseAllowsAttack ??
    env?.allowAttack ??
    env?.canAttack ??
    env?.phaseWindow?.allowAttack ??
    env?.phaseWindow?.canAttack;
  if (explicit !== undefined && explicit !== null) {
    return !!explicit;
  }
  const phase = (env?.phase ?? "").toString().toUpperCase();
  return phase === "MAIN_PHASE";
}

function collectActiveEffects(unit?: any) {
  const effects = [
    ...(Array.isArray(unit?.activeEffects) ? unit.activeEffects : []),
    ...(Array.isArray(unit?.effects?.active) ? unit.effects.active : []),
    ...(Array.isArray(unit?.effects?.activeEffects) ? unit.effects.activeEffects : []),
    ...(Array.isArray(unit?.cardData?.effects?.active) ? unit.cardData.effects.active : []),
  ];
  return effects.filter(Boolean);
}

function hasAttackShieldRestriction(raw: any, playerId: string, slotId?: string) {
  if (!raw || !slotId) return false;
  const slot = raw?.gameEnv?.players?.[playerId]?.zones?.[slotId];
  const unit = slot?.unit;
  const effects = collectActiveEffects(unit);
  return effects.some((effect) => {
    const action = (effect?.action ?? "").toString().toLowerCase();
    const restriction = (effect?.parameters?.restriction ?? "").toString().toLowerCase();
    return action === "restrict_attack" && restriction === "cannot_attack_player";
  });
}

export function buildSlotAttackActionDescriptors(input: {
  raw: any;
  selection: any;
  selectedSlot?: SlotViewModel;
  opponentUnitSlots: SlotViewModel[];
  playerId: string;
}): ActionDescriptor[] {
  const { raw, selection, selectedSlot, opponentUnitSlots, playerId } = input;
  const phaseOk = phaseAllowsAttack(raw);
  const attackTargets = getAttackUnitTargets(selectedSlot, opponentUnitSlots);
  const slotState = computeSlotActionState({
    selection,
    opponentHasUnit: attackTargets.length > 0,
    attackerReady: selectedSlot?.unit?.canAttackThisTurn === true && selectedSlot?.unit?.isRested !== true,
    hasUnit: !!selectedSlot?.unit,
    phaseAllowsAttack: phaseOk,
  });
  if (!slotState.shouldApply) return [];

  const allowAttackShield = !hasAttackShieldRestriction(raw, playerId, selectedSlot?.slotId);
  return buildSlotActionDescriptors(slotState.opponentHasUnit, slotState.attackerReady, allowAttackShield)
    .filter((d) => d.id !== "cancelSelection")
    .map((d) => ({
      id: d.id,
      label: d.label,
      enabled: d.enabled,
      primary: d.primary,
    }));
}
