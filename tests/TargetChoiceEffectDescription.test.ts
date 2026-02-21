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
});
