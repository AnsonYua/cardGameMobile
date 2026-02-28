import { describe, expect, it } from "vitest";
import { SlotPresenter } from "../src/phaser/ui/SlotPresenter";

describe("SlotPresenter", () => {
  it("maps activationLocks from raw unit data into SlotCardView", () => {
    const presenter = new SlotPresenter();
    const raw = {
      gameEnv: {
        players: {
          playerId_1: {
            zones: {
              slot1: {
                unit: {
                  cardId: "GD02-015",
                  carduid: "GD02-015_enemy_alt_target_0002",
                  isRested: true,
                  canAttackThisTurn: false,
                  activationLocks: [
                    {
                      kind: "prevent_set_active_next_turn",
                      sourceCarduid: "GD02-004_friendly_unit_0001",
                      remainingStartPhases: 1,
                    },
                  ],
                  cardData: { cardType: "unit", name: "Marasai" },
                },
                fieldCardValue: { totalAP: 3, totalHP: 3 },
              },
            },
          },
          playerId_2: { zones: {} },
        },
      },
    };

    const slots = presenter.toSlots(raw, "playerId_2");
    const opponentSlot1 = slots.find((slot) => slot.owner === "opponent" && slot.slotId === "slot1");

    expect(opponentSlot1?.unit?.activationLocks).toBeTruthy();
    expect(opponentSlot1?.unit?.activationLocks?.[0]?.kind).toBe("prevent_set_active_next_turn");
    expect(opponentSlot1?.unit?.activationLocks?.[0]?.remainingStartPhases).toBe(1);
  });
});
