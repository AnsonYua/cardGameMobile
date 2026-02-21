import { describe, expect, it } from "vitest";
import { resolveTargetChoiceEffectDescription } from "../src/phaser/controllers/targeting/TargetChoiceEffectDescription";

describe("TargetChoiceEffectDescription", () => {
  it("resolves source-card description by sequenceEffectId mapping", () => {
    const raw = {
      gameEnv: {
        players: {
          p1: {
            zones: {
              slot1: {
                unit: {
                  carduid: "source_1",
                  cardData: {
                    effects: {
                      description: ["[Activate] Support text", "[When rested] bonus text"],
                      rules: [{ effectId: "activate_effect" }, { effectId: "rested_effect" }],
                    },
                  },
                },
              },
            },
          },
        },
      },
    };

    const payload = {
      choice: {
        sourceCarduid: "source_1",
      },
    };
    const data = {
      sourceCarduid: "source_1",
      effect: { action: "modifyAP" },
      context: {
        ctx: {
          sequenceEffectId: "activate_effect",
        },
      },
    };

    expect(resolveTargetChoiceEffectDescription({ raw, payload, data })).toBe("[Activate] Support text");
  });

  it("falls back by action/trigger shape when effectId is not present in choice context", () => {
    const raw = {
      gameEnv: {
        players: {
          p1: {
            zones: {
              slot1: {
                unit: {
                  carduid: "source_2",
                  cardData: {
                    effects: {
                      description: ["[Burst] Add this card to your hand.", "[When Paired] Deal 3 damage."],
                      rules: [
                        { effectId: "burst_add_to_hand", trigger: "BURST_CONDITION", action: "addToHand" },
                        { effectId: "pair_damage", trigger: "PAIRING_COMPLETE", action: "damage" },
                      ],
                    },
                  },
                },
              },
            },
          },
        },
      },
    };

    const payload = { choice: { sourceCarduid: "source_2" } };
    const data = {
      sourceCarduid: "source_2",
      effect: { trigger: "PAIRING_COMPLETE", action: "damage" },
    };

    expect(resolveTargetChoiceEffectDescription({ raw, payload, data })).toBe("[When Paired] Deal 3 damage.");
  });

  it("falls back to first available description when no effect mapping is available", () => {
    const raw = {
      gameEnv: {
        players: {
          p1: {
            zones: {
              slot1: {
                unit: {
                  carduid: "source_3",
                  cardData: {
                    effects: {
                      description: ["Fallback text"],
                      rules: [{ effectId: "some_other_effect", trigger: "ENTERS_PLAY", action: "draw" }],
                    },
                  },
                },
              },
            },
          },
        },
      },
    };

    const payload = { choice: { sourceCarduid: "source_3" } };
    const data = {
      sourceCarduid: "source_3",
      effect: { trigger: "PAIRING_COMPLETE", action: "damage" },
    };

    expect(resolveTargetChoiceEffectDescription({ raw, payload, data })).toBe("Fallback text");
  });
});
