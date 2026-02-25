import { describe, expect, it } from "vitest";
import { buildSlotAttackActionDescriptors } from "../src/phaser/controllers/actionBar/slotAttackProvider";
import type { SlotViewModel } from "../src/phaser/ui/SlotTypes";

function createSelectedSlot(slotId = "slot1"): SlotViewModel {
  return {
    owner: "player",
    slotId,
    unit: {
      cardUid: `${slotId}_unit`,
      isRested: false,
      canAttackThisTurn: true,
      cardData: { effects: { rules: [] } },
    },
  };
}

function createOpponentRestedSlot(slotId = "slot1"): SlotViewModel {
  return {
    owner: "opponent",
    slotId,
    unit: {
      cardUid: `${slotId}_enemy`,
      isRested: true,
      canAttackThisTurn: true,
      cardData: { ap: 2, level: 2, effects: { rules: [] } },
    },
  };
}

describe("slotAttackProvider", () => {
  it("hides Attack Shield when static restrict_attack disallow=player exists", () => {
    const raw = {
      gameEnv: {
        phase: "MAIN_PHASE",
        players: {
          playerId_1: {
            zones: {
              slot1: {
                unit: {
                  carduid: "slot1_unit",
                  cardData: {
                    effects: {
                      rules: [{ action: "restrict_attack", parameters: { disallow: "player" } }],
                    },
                  },
                },
              },
            },
          },
        },
      },
    };

    const descriptors = buildSlotAttackActionDescriptors({
      raw,
      selection: { kind: "slot", owner: "player", slotId: "slot1" },
      selectedSlot: createSelectedSlot("slot1"),
      opponentUnitSlots: [createOpponentRestedSlot("slotA")],
      playerId: "playerId_1",
    });

    expect(descriptors.some((d) => d.id === "attackUnit")).toBe(true);
    expect(descriptors.some((d) => d.id === "attackShieldArea")).toBe(false);
  });

  it("disables Attack Unit when dynamic restrict_attack requirement is unmet", () => {
    const raw = {
      gameEnv: {
        phase: "MAIN_PHASE",
        players: {
          playerId_1: {
            zones: {
              slot1: {
                unit: {
                  carduid: "slot1_unit",
                  cardData: {
                    effects: {
                      rules: [
                        {
                          action: "restrict_attack",
                          parameters: {
                            requires: {
                              type: "friendly_unit_deployed_this_turn",
                              traitsAny: ["Superpower Bloc", "United Nations"],
                            },
                          },
                        },
                      ],
                    },
                  },
                },
              },
              slot2: {
                unit: {
                  carduid: "slot2_unit",
                  playedThisTurn: false,
                  cardData: { traits: ["Superpower Bloc"] },
                },
              },
            },
          },
        },
      },
    };

    const descriptors = buildSlotAttackActionDescriptors({
      raw,
      selection: { kind: "slot", owner: "player", slotId: "slot1" },
      selectedSlot: createSelectedSlot("slot1"),
      opponentUnitSlots: [createOpponentRestedSlot("slotA")],
      playerId: "playerId_1",
    });

    const attackUnit = descriptors.find((d) => d.id === "attackUnit");
    expect(attackUnit).toBeTruthy();
    expect(attackUnit?.enabled).toBe(false);
  });

  it("enables Attack Unit when dynamic restrict_attack requirement is met", () => {
    const raw = {
      gameEnv: {
        phase: "MAIN_PHASE",
        players: {
          playerId_1: {
            zones: {
              slot1: {
                unit: {
                  carduid: "slot1_unit",
                  cardData: {
                    effects: {
                      rules: [
                        {
                          action: "restrict_attack",
                          parameters: {
                            requires: {
                              type: "friendly_unit_deployed_this_turn",
                              traitsAny: ["Superpower Bloc", "United Nations"],
                            },
                          },
                        },
                      ],
                    },
                  },
                },
              },
              slot2: {
                unit: {
                  carduid: "slot2_unit",
                  playedThisTurn: true,
                  cardData: { traits: ["United Nations"] },
                },
              },
            },
          },
        },
      },
    };

    const descriptors = buildSlotAttackActionDescriptors({
      raw,
      selection: { kind: "slot", owner: "player", slotId: "slot1" },
      selectedSlot: createSelectedSlot("slot1"),
      opponentUnitSlots: [createOpponentRestedSlot("slotA")],
      playerId: "playerId_1",
    });

    const attackUnit = descriptors.find((d) => d.id === "attackUnit");
    expect(attackUnit).toBeTruthy();
    expect(attackUnit?.enabled).toBe(true);
  });
});
