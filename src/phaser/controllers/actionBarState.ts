import type { ActionDescriptor } from "../game/ActionRegistry";
import type { ActionSource } from "../game/GameEngine";
import { isStartGamePhase } from "./actionBarRules";

export type ActionBarDecision =
  | { kind: "waiting"; label: string }
  | { kind: "blocker" }
  | { kind: "actionStep"; isOpponentTurn: boolean }
  | { kind: "mainFlow" };

export function computeActionBarDecision(input: {
  phase: string;
  isSelfTurn: boolean;
  actionStepStatus: string;
  blockerActive: boolean;
  isBlockerPhase: boolean;
}): ActionBarDecision {
  if (isStartGamePhase(input.phase)) {
    return { kind: "waiting", label: "Preparing to start game..." };
  }
  if (input.blockerActive || input.isBlockerPhase) {
    return { kind: "blocker" };
  }
  if (input.actionStepStatus !== "none") {
    return { kind: "actionStep", isOpponentTurn: !input.isSelfTurn };
  }
  if (!input.isSelfTurn) {
    return { kind: "waiting", label: "Waiting for opponent..." };
  }
  return { kind: "mainFlow" };
}

export type SlotActionStateInput = {
  selection: any;
  opponentHasUnit: boolean;
  attackerReady: boolean;
  hasUnit: boolean;
  phaseAllowsAttack: boolean;
};

export type SlotActionStateResult =
  | { shouldApply: false }
  | { shouldApply: true; opponentHasUnit: boolean; attackerReady: boolean };

export function computeSlotActionState(input: SlotActionStateInput): SlotActionStateResult {
  if (input.selection?.kind !== "slot" || input.selection.owner !== "player") {
    return { shouldApply: false };
  }
  if (!input.phaseAllowsAttack) return { shouldApply: false };
  if (!input.hasUnit) return { shouldApply: false };
  return {
    shouldApply: true,
    opponentHasUnit: input.opponentHasUnit,
    attackerReady: input.attackerReady,
  };
}

export type MainPhaseStateInput = {
  phase: string | undefined;
  selection: any;
  source: ActionSource;
  battleActive: boolean;
  lastPhase?: string;
  lastBattleActive: boolean;
  defaultActions: ActionDescriptor[];
  selectedActions: ActionDescriptor[];
};

export type MainPhaseStateResult = {
  shouldUpdate: boolean;
  setHand: boolean;
  descriptors?: ActionDescriptor[];
  lastPhase?: string;
  lastBattleActive: boolean;
};

export function computeMainPhaseState(input: MainPhaseStateInput): MainPhaseStateResult {
  const phase = input.phase;
  const battleActive = input.battleActive;
  const selection = input.selection;

  if (!phase) {
    return {
      shouldUpdate: false,
      setHand: false,
      lastPhase: phase,
      lastBattleActive: false,
    };
  }

  if (!battleActive && input.lastPhase === "MAIN_PHASE") {
    if (!selection) {
      return {
        shouldUpdate: true,
        setHand: true,
        descriptors: input.defaultActions,
        lastPhase: phase,
        lastBattleActive: battleActive,
      };
    }
    return {
      shouldUpdate: true,
      setHand: false,
      descriptors: input.selectedActions,
      lastPhase: phase,
      lastBattleActive: battleActive,
    };
  }

  if (input.lastPhase !== "MAIN_PHASE") {
    return {
      shouldUpdate: true,
      setHand: true,
      descriptors: input.defaultActions,
      lastPhase: phase,
      lastBattleActive: battleActive,
    };
  }

  return {
    shouldUpdate: false,
    setHand: false,
    lastPhase: phase,
    lastBattleActive: battleActive,
  };
}
