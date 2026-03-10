import { describe, expect, it } from "vitest";
import { analyzeUnitPlaySubmission } from "../src/phaser/controllers/unit/unitPlaySubmission";

function createRaw(overrides: Partial<any> = {}) {
  return {
    gameEnv: {
      phase: "MAIN_PHASE",
      playerId_1: "player_1",
      playerId_2: "player_2",
      currentTurn: 1,
      currentPlayer: "player_1",
      players: {
        player_1: {
          zones: {
            slot1: {},
            slot2: {},
            slot3: {},
            slot4: {},
            slot5: {},
            slot6: {},
            energyArea: [],
          },
          deck: {
            hand: [],
          },
        },
      },
    },
    ...overrides,
  };
}

describe("analyzeUnitPlaySubmission", () => {
  it("treats a normal unit play as immediate", () => {
    const raw = createRaw({
      gameEnv: {
        ...createRaw().gameEnv,
        players: {
          player_1: {
            zones: {
              slot1: {},
              slot2: {},
              slot3: {},
              slot4: {},
              slot5: {},
              slot6: {},
              energyArea: [],
            },
            deck: {
              hand: [{ carduid: "unit_1", cardData: { effects: { rules: [] } } }],
            },
          },
        },
      },
    });

    expect(
      analyzeUnitPlaySubmission({
        raw,
        playerId: "player_1",
        selectionUid: "unit_1",
      }),
    ).toMatchObject({
      submitsImmediately: true,
      requiresCostReplacementConfirm: false,
      requiresReplacementTargetSelection: false,
      requiresBoardReplacementSelection: false,
    });
  });

  it("treats a full board as a local replacement selection first", () => {
    const fullZones = Object.fromEntries(
      ["slot1", "slot2", "slot3", "slot4", "slot5", "slot6"].map((slotId) => [
        slotId,
        { unit: { carduid: `${slotId}_unit`, cardData: {} } },
      ]),
    );
    const raw = createRaw({
      gameEnv: {
        ...createRaw().gameEnv,
        players: {
          player_1: {
            zones: {
              ...fullZones,
              energyArea: [],
            },
            deck: {
              hand: [{ carduid: "unit_1", cardData: { effects: { rules: [] } } }],
            },
          },
        },
      },
    });

    expect(
      analyzeUnitPlaySubmission({
        raw,
        playerId: "player_1",
        selectionUid: "unit_1",
      }),
    ).toMatchObject({
      submitsImmediately: false,
      requiresBoardReplacementSelection: true,
    });
  });

  it("treats optional cost replacement as a local confirmation first", () => {
    const raw = createRaw({
      gameEnv: {
        ...createRaw().gameEnv,
        players: {
          player_1: {
            zones: {
              slot1: {
                unit: {
                  carduid: "linked_1",
                  cardData: { name: "Unicorn", level: 5, link: ["Pilot A"], cardType: "unit" },
                },
                pilot: {
                  carduid: "pilot_1",
                  cardData: { name: "Pilot A" },
                },
              },
              slot2: {},
              slot3: {},
              slot4: {},
              slot5: {},
              slot6: {},
              energyArea: [{ isRested: false }, { isRested: false }, { isRested: false }],
            },
            deck: {
              hand: [
                {
                  carduid: "unit_1",
                  cardData: {
                    level: 2,
                    cost: 2,
                    effects: {
                      rules: [
                        {
                          type: "play",
                          trigger: "cost",
                          action: "replace_cost",
                          parameters: {
                            replace: {
                              from: {
                                type: "destroy",
                                target: "friendly_linked_unit",
                                filters: { level: 5 },
                              },
                              to: { level: 0, cost: 0 },
                            },
                          },
                        },
                      ],
                    },
                  },
                },
              ],
            },
          },
        },
      },
    });

    expect(
      analyzeUnitPlaySubmission({
        raw,
        playerId: "player_1",
        selectionUid: "unit_1",
      }),
    ).toMatchObject({
      submitsImmediately: false,
      requiresCostReplacementConfirm: true,
    });
  });
});
