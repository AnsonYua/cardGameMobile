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
  const cardRestriction = getCardRestrictionState(raw, playerId, slotId);
  if (cardRestriction.cannotAttack || cardRestriction.cannotAttackPlayer) {
    return true;
  }

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

function hasCannotAttackRestriction(raw: any, playerId: string, slotId?: string) {
  const cardRestriction = getCardRestrictionState(raw, playerId, slotId);
  if (cardRestriction.cannotAttack) {
    return true;
  }
  if (!raw || !slotId) return false;
  const slot = raw?.gameEnv?.players?.[playerId]?.zones?.[slotId];
  const unit = slot?.unit;
  const effects = collectActiveEffects(unit);
  return effects.some((effect) => {
    const action = (effect?.action ?? "").toString().toLowerCase();
    const restriction = (effect?.parameters?.restriction ?? "").toString().toLowerCase();
    return action === "restrict_attack" && (restriction === "cannot_attack" || restriction === "all");
  });
}

function getCardRestrictionState(raw: any, playerId: string, slotId?: string): { cannotAttack: boolean; cannotAttackPlayer: boolean } {
  if (!raw || !playerId || !slotId) {
    return { cannotAttack: false, cannotAttackPlayer: false };
  }

  const slot = raw?.gameEnv?.players?.[playerId]?.zones?.[slotId];
  const unit = slot?.unit;
  if (!unit) return { cannotAttack: false, cannotAttackPlayer: false };

  const rules = Array.isArray(unit?.cardData?.effects?.rules) ? unit.cardData.effects.rules : [];
  let cannotAttack = false;
  let cannotAttackPlayer = false;

  for (const rule of rules) {
    const action = (rule?.action ?? "").toString().toLowerCase();
    if (action !== "restrict_attack") continue;

    const requires = rule?.parameters?.requires;
    if (requires && typeof requires === "object") {
      const requirementType = (requires.type ?? "").toString();
      if (requirementType === "friendly_unit_deployed_this_turn") {
        const requiredTraits = Array.isArray(requires.traitsAny) ? requires.traitsAny.filter((t: unknown) => typeof t === "string") : [];
        const met = isFriendlyUnitDeployedThisTurn(raw, playerId, requiredTraits);
        if (!met) {
          cannotAttack = true;
        }
      }
    }

    const disallow = rule?.parameters?.disallow;
    if (typeof disallow === "string") {
      if (disallow === "player") {
        cannotAttackPlayer = true;
      } else if (disallow === "cannot_attack" || disallow === "all") {
        cannotAttack = true;
      }
    } else if (disallow === true) {
      cannotAttack = true;
    }

    const restriction = (rule?.parameters?.restriction ?? rule?.parameters?.restrictions ?? "").toString().toLowerCase();
    if (restriction === "cannot_attack_player") {
      cannotAttackPlayer = true;
    } else if (restriction === "cannot_attack" || restriction === "all") {
      cannotAttack = true;
    }
  }

  return { cannotAttack, cannotAttackPlayer };
}

function isFriendlyUnitDeployedThisTurn(
  raw: any,
  playerId: string,
  requiredTraits: string[],
): boolean {
  const zones = raw?.gameEnv?.players?.[playerId]?.zones ?? {};
  const slots = ["slot1", "slot2", "slot3", "slot4", "slot5", "slot6"];
  return slots.some((slotId) => {
    const unit = zones?.[slotId]?.unit;
    if (!unit || unit.playedThisTurn !== true) return false;
    if (!requiredTraits.length) return true;
    const traits = Array.isArray(unit?.cardData?.traits) ? unit.cardData.traits : [];
    return requiredTraits.some((trait) => traits.includes(trait));
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
  const cannotAttack = hasCannotAttackRestriction(raw, playerId, selectedSlot?.slotId);
  const slotState = computeSlotActionState({
    selection,
    opponentHasUnit: attackTargets.length > 0,
    attackerReady: selectedSlot?.unit?.canAttackThisTurn === true && selectedSlot?.unit?.isRested !== true && !cannotAttack,
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
