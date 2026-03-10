import { describe, expect, it } from "vitest";
import { resolveImmediateAbilityActivation } from "../src/phaser/controllers/ability/immediateAbilityActivation";

describe("resolveImmediateAbilityActivation", () => {
  it("returns the single enabled unit effect for a selected slot", () => {
    const raw = {
      gameEnv: {
        phase: "MAIN_PHASE",
        playerId_1: "player_1",
        playerId_2: "player_2",
        currentTurn: 1,
        currentPlayer: "player_1",
        players: {
          player_1: {
            zones: {
              slot1: {
                unit: {
                  carduid: "unit_1",
                  isRested: false,
                  cardData: {
                    effects: {
                      rules: [{ type: "activated", effectId: "effect_1" }],
                    },
                  },
                },
              },
              energyArea: [],
            },
          },
        },
      },
    };

    expect(
      resolveImmediateAbilityActivation({
        raw,
        selection: { kind: "slot", owner: "player", slotId: "slot1" },
        playerId: "player_1",
      }),
    ).toEqual({ carduid: "unit_1", effectId: "effect_1" });
  });

  it("returns undefined when multiple enabled effects are available", () => {
    const raw = {
      gameEnv: {
        phase: "MAIN_PHASE",
        playerId_1: "player_1",
        playerId_2: "player_2",
        currentTurn: 1,
        currentPlayer: "player_1",
        players: {
          player_1: {
            zones: {
              slot1: {
                unit: {
                  carduid: "unit_1",
                  isRested: false,
                  cardData: {
                    effects: {
                      rules: [
                        { type: "activated", effectId: "effect_1" },
                        { type: "activated", effectId: "effect_2" },
                      ],
                    },
                  },
                },
              },
              energyArea: [],
            },
          },
        },
      },
    };

    expect(
      resolveImmediateAbilityActivation({
        raw,
        selection: { kind: "slot", owner: "player", slotId: "slot1" },
        playerId: "player_1",
      }),
    ).toBeUndefined();
  });

  it("returns undefined when the only effect is disabled", () => {
    const raw = {
      gameEnv: {
        phase: "MAIN_PHASE",
        playerId_1: "player_1",
        playerId_2: "player_2",
        currentTurn: 1,
        currentPlayer: "player_1",
        players: {
          player_1: {
            zones: {
              slot1: {
                unit: {
                  carduid: "unit_1",
                  isRested: true,
                  cardData: {
                    effects: {
                      rules: [{ type: "activated", effectId: "effect_1", cost: { rest: "self" } }],
                    },
                  },
                },
              },
              energyArea: [],
            },
          },
        },
      },
    };

    expect(
      resolveImmediateAbilityActivation({
        raw,
        selection: { kind: "slot", owner: "player", slotId: "slot1" },
        playerId: "player_1",
      }),
    ).toBeUndefined();
  });
});
