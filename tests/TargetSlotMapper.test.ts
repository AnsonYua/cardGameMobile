import { describe, expect, it } from "vitest";
import { mapAvailableTargetsToSlotTargets } from "../src/phaser/controllers/TargetSlotMapper";

describe("mapAvailableTargetsToSlotTargets", () => {
  it("maps canonical target cardData shape to preview texture key", () => {
    const slotPresenter = {
      toSlots: () => [{ owner: "player", slotId: "shield", fieldCardValue: { totalAP: 0, totalHP: 0 } }],
    } as any;

    const targets = mapAvailableTargetsToSlotTargets(
      slotPresenter,
      { gameEnv: {} },
      [
        {
          carduid: "GD03-044_shield_p1_0001",
          zone: "shield",
          playerId: "playerId_1",
          cardData: { id: "GD03-044", cardType: "unit", ap: 2, hp: 3 },
        },
      ],
      "playerId_1",
    );

    expect(targets).toHaveLength(1);
    expect(targets[0].slot.unit?.id).toBe("GD03-044");
    expect(targets[0].slot.unit?.textureKey).toBe("GD03-044-preview");
    expect(targets[0].slot.fieldCardValue?.totalAP).toBe(2);
    expect(targets[0].slot.fieldCardValue?.totalHP).toBe(3);
  });

  it("maps legacy nested target cardData.cardData shape to preview texture key", () => {
    const slotPresenter = {
      toSlots: () => [{ owner: "player", slotId: "shield", fieldCardValue: { totalAP: 0, totalHP: 0 } }],
    } as any;

    const targets = mapAvailableTargetsToSlotTargets(
      slotPresenter,
      { gameEnv: {} },
      [
        {
          carduid: "GD03-045_shield_p1_0002",
          zone: "shield",
          playerId: "playerId_1",
          cardData: {
            carduid: "GD03-045_shield_p1_0002",
            cardId: "GD03-045",
            cardData: { id: "GD03-045", cardType: "unit", ap: 2, hp: 4 },
          },
        },
      ],
      "playerId_1",
    );

    expect(targets).toHaveLength(1);
    expect(targets[0].slot.unit?.id).toBe("GD03-045");
    expect(targets[0].slot.unit?.textureKey).toBe("GD03-045-preview");
    expect(targets[0].slot.unit?.cardData?.id).toBe("GD03-045");
    expect(targets[0].slot.fieldCardValue?.totalAP).toBe(2);
    expect(targets[0].slot.fieldCardValue?.totalHP).toBe(4);
  });

  it("falls back safely when card metadata is missing", () => {
    const slotPresenter = {
      toSlots: () => [{ owner: "player", slotId: "trash", fieldCardValue: { totalAP: 0, totalHP: 0 } }],
    } as any;

    const targets = mapAvailableTargetsToSlotTargets(
      slotPresenter,
      { gameEnv: {} },
      [
        {
          carduid: "UNKNOWN_UID_001",
          zone: "trash",
          playerId: "playerId_1",
        },
      ],
      "playerId_1",
    );

    expect(targets).toHaveLength(1);
    expect(targets[0].slot.unit?.id).toBe("UNKNOWN_UID_001");
    expect(targets[0].slot.unit?.textureKey).toBe("UNKNOWN_UID_001-preview");
  });

  it("keeps existing pilot mapping behavior unchanged", () => {
    const slotPresenter = {
      toSlots: () => [{ owner: "player", slotId: "slot1", fieldCardValue: { totalAP: 0, totalHP: 0 } }],
    } as any;

    const targets = mapAvailableTargetsToSlotTargets(
      slotPresenter,
      { gameEnv: {} },
      [
        {
          carduid: "PILOT_UID_001",
          zone: "slot1",
          playerId: "playerId_1",
          cardData: { id: "P-001", cardType: "pilot", ap: 1, hp: 1 },
        },
      ],
      "playerId_1",
    );

    expect(targets).toHaveLength(1);
    expect(targets[0].slot.pilot?.id).toBe("P-001");
    expect(targets[0].slot.unit).toBeUndefined();
  });
});
