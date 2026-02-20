import { describe, expect, it } from "vitest";
import { getAttackUnitTargets } from "../src/phaser/controllers/attackTargetPolicy";
import type { SlotViewModel } from "../src/phaser/ui/SlotTypes";

function createOpponentSlot(slotId: string, opts: { rested?: boolean; level?: number; ap?: number; damageReceived?: number } = {}): SlotViewModel {
  return {
    owner: "opponent",
    slotId,
    unit: {
      cardUid: `${slotId}_unit`,
      isRested: opts.rested ?? false,
      cardData: {
        level: opts.level ?? 3,
        ap: opts.ap ?? 3,
      },
      ...(typeof opts.damageReceived === "number" ? ({ damageReceived: opts.damageReceived } as any) : {}),
    } as any,
  };
}

describe("attackTargetPolicy", () => {
  it("does not allow active enemy target for allowAttackOnDeployTurn-only rule", () => {
    const attacker: SlotViewModel = {
      owner: "player",
      slotId: "slot1",
      unit: {
        cardUid: "GD01-066_unit",
        cardData: {
          effects: {
            rules: [
              {
                action: "allow_attack_target",
                sourceConditions: [{ type: "paired" }],
                parameters: { allowAttackOnDeployTurn: true },
              },
            ],
          },
        },
      },
      pilot: {
        cardUid: "pilot_1",
        cardData: { effects: { rules: [] } },
      },
    };
    const opponentSlots = [createOpponentSlot("slotA", { rested: false })];

    const targets = getAttackUnitTargets(attacker, opponentSlots);
    expect(targets).toHaveLength(0);
  });

  it("allows active enemy target when explicit active-target rule exists", () => {
    const attacker: SlotViewModel = {
      owner: "player",
      slotId: "slot1",
      unit: {
        cardUid: "explicit_unit",
        cardData: {
          effects: {
            rules: [
              {
                action: "allow_attack_target",
                parameters: { status: "active", level: "<=5" },
              },
            ],
          },
        },
      },
    };
    const opponentSlots = [createOpponentSlot("slotB", { rested: false, level: 4 })];

    const targets = getAttackUnitTargets(attacker, opponentSlots);
    expect(targets).toHaveLength(1);
    expect(targets[0].slotId).toBe("slotB");
  });
});
