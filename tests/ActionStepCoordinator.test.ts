import { describe, expect, it, vi } from "vitest";
import { ActionStepCoordinator } from "../src/phaser/controllers/ActionStepCoordinator";

function createRaw(unit: any, effectIds: string[] = ["effect_1"]) {
  return {
    gameEnv: {
      phase: "MAIN_PHASE",
      currentPlayer: "player_1",
      currentBattle: {
        status: "ACTION_STEP",
        confirmations: { player_1: false },
        actionTargets: {
          player_1: [
            {
              carduid: "unit_1",
              effectIds,
            },
          ],
        },
      },
      players: {
        player_1: {
          zones: {
            slot1: { unit },
            energyArea: [],
          },
        },
      },
    },
  };
}

describe("ActionStepCoordinator", () => {
  it("disables single disabled unit-effect buttons and avoids request-loading", () => {
    const raw = createRaw({
      carduid: "unit_1",
      isRested: true,
      cardData: {
        effects: {
          rules: [{ type: "activated", effectId: "effect_1", cost: { rest: "self" } }],
        },
      },
    });
    const setState = vi.fn();
    const slot = {
      owner: "player",
      slotId: "slot1",
      unit: {
        cardUid: "unit_1",
        isRested: true,
        cardData: raw.gameEnv.players.player_1.zones.slot1.unit.cardData,
      },
    };
    const coordinator = new ActionStepCoordinator({
      engine: { getSnapshot: vi.fn(() => ({ raw })) } as any,
      slotPresenter: { toSlots: vi.fn(() => [slot]) } as any,
      gameContext: { playerId: "player_1" } as any,
      actionControls: { setState, setWaitingForOpponent: vi.fn() } as any,
      callbacks: {
        onSkipAction: vi.fn(),
        onCancelSelection: vi.fn(),
        onTriggerSelection: vi.fn(),
        onTriggerPilot: vi.fn(),
        onTriggerUnit: vi.fn(),
      },
    });

    coordinator.applyActionBar({ kind: "slot", owner: "player", slotId: "slot1" }, "awaiting");

    const descriptors = setState.mock.calls[0][0].descriptors;
    const triggerUnit = descriptors.find((descriptor: any) => descriptor.label === "Trigger Unit Effect");
    expect(triggerUnit).toBeTruthy();
    expect(triggerUnit.enabled).toBe(false);
    expect(triggerUnit.triggersRequestLoading).toBe(false);
  });

  it("marks one-enabled-one-disabled unit-effect buttons as immediate request-loading", () => {
    const raw = createRaw({
      carduid: "unit_1",
      isRested: false,
      cardData: {
        effects: {
          rules: [
            { type: "activated", effectId: "effect_1" },
            { type: "activated", effectId: "effect_2", cost: { resource: 1 } },
          ],
        },
      },
    }, ["effect_1", "effect_2"]);
    const setState = vi.fn();
    const slot = {
      owner: "player",
      slotId: "slot1",
      unit: {
        cardUid: "unit_1",
        isRested: false,
        cardData: raw.gameEnv.players.player_1.zones.slot1.unit.cardData,
      },
    };
    const coordinator = new ActionStepCoordinator({
      engine: { getSnapshot: vi.fn(() => ({ raw })) } as any,
      slotPresenter: { toSlots: vi.fn(() => [slot]) } as any,
      gameContext: { playerId: "player_1" } as any,
      actionControls: { setState, setWaitingForOpponent: vi.fn() } as any,
      callbacks: {
        onSkipAction: vi.fn(),
        onCancelSelection: vi.fn(),
        onTriggerSelection: vi.fn(),
        onTriggerPilot: vi.fn(),
        onTriggerUnit: vi.fn(),
      },
    });

    coordinator.applyActionBar({ kind: "slot", owner: "player", slotId: "slot1" }, "awaiting");

    const descriptors = setState.mock.calls[0][0].descriptors;
    const triggerUnit = descriptors.find((descriptor: any) => descriptor.label === "Trigger Unit Effect");
    expect(triggerUnit).toBeTruthy();
    expect(triggerUnit.enabled).toBe(true);
    expect(triggerUnit.triggersRequestLoading).toBe(true);
  });
});
