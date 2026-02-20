import { describe, expect, it } from "vitest";
import { resolveOptionCardId } from "../src/phaser/controllers/choice/OptionChoiceCardResolver";

describe("resolveOptionCardId", () => {
  it("resolves from TOP_DECK_VIEWED payload when option only has carduid", () => {
    const raw = {
      gameEnv: {
        notificationQueue: [
          {
            type: "TOP_DECK_VIEWED",
            payload: {
              playerId: "p2",
              effectId: "destroyed_tutor_zeon_unit_from_top_3",
              cards: [
                { carduid: "ST03-001_abc", cardId: "ST03-001", name: "Sinanju" },
                { carduid: "GD03-035_xyz", cardId: "GD03-035", name: "GFreD" },
              ],
            },
          },
        ],
      },
    };

    const option = {
      index: 0,
      label: "Reveal and add ST03-001 to hand",
      payload: { action: "TAKE", carduid: "ST03-001_abc" },
    };

    expect(resolveOptionCardId(raw, option)).toBe("ST03-001");
  });

  it("resolves tutor label pattern: Reveal and add <CARD_ID> to hand", () => {
    const raw = { gameEnv: { players: {} } };
    const option = {
      index: 0,
      label: "Reveal and add ST03-001 to hand",
      payload: { action: "TAKE" },
    };

    expect(resolveOptionCardId(raw, option)).toBe("ST03-001");
  });

  it("returns undefined when no payload/notification/label match exists", () => {
    const raw = { gameEnv: { players: {}, notificationQueue: [] } };
    const option = {
      index: 2,
      label: "Put it on the bottom of your deck",
      payload: { action: "BOTTOM" },
    };

    expect(resolveOptionCardId(raw, option)).toBeUndefined();
  });
});
