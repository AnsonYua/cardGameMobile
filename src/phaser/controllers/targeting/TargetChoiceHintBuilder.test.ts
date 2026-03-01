import { describe, expect, test } from "vitest";
import { buildTargetChoiceHint } from "./TargetChoiceHintBuilder";

describe("TargetChoiceHintBuilder", () => {
  test("explains damaged-only filter and excluded undamaged declared attack target", () => {
    const raw = {
      gameEnv: {
        notificationQueue: [
          {
            id: "unit_attack_declared_1",
            type: "UNIT_ATTACK_DECLARED",
            payload: {
              targetCarduid: "GD02-013_enemy_pair_choice_0004",
              targetName: "Hizack",
              targetSlotName: "slot4",
            },
          },
        ],
        players: {
          playerId_2: {
            zones: {
              slot4: {
                unit: {
                  carduid: "GD02-013_enemy_pair_choice_0004",
                  damageReceived: 0,
                  cardData: { name: "Hizack" },
                },
                fieldCardValue: {
                  totalDamageReceived: 0,
                },
              },
            },
          },
        },
      },
    };

    const payload = {};
    const data = {
      cardPlayNotificationId: "unit_attack_declared_1",
      effect: {
        target: {
          filters: { damaged: true },
        },
      },
    };
    const availableTargets = [{ carduid: "GD02-006_enemy_damaged_target_0001" }];

    const hint = buildTargetChoiceHint({ raw, payload, data, availableTargets });
    expect(hint).toContain("Only damaged enemy units are selectable.");
    expect(hint).toContain("Hizack (slot4) is not damaged, so it is not selectable.");
  });

  test("returns no hint when no supported filter exists", () => {
    const hint = buildTargetChoiceHint({
      raw: {},
      payload: {},
      data: {
        effect: {
          target: {
            filters: {},
          },
        },
      },
      availableTargets: [],
    });
    expect(hint).toBeUndefined();
  });
});
