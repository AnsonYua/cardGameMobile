import { describe, expect, test } from "vitest";
import { resolveCardAddedToHandView } from "./NotificationVisibilityRules";

describe("resolveCardAddedToHandView", () => {
  test("keeps self hand-add popup visible", () => {
    expect(
      resolveCardAddedToHandView({
        eventType: "CARD_ADDED_TO_HAND",
        payload: { playerId: "player-1", sourceZone: "shield" },
        currentPlayerId: "player-1",
      }),
    ).toEqual({
      visible: true,
      mode: "self",
      title: "Card Added to Hand",
    });
  });

  test("hides opponent shield-to-hand popup even when payload says reveal", () => {
    expect(
      resolveCardAddedToHandView({
        eventType: "CARD_ADDED_TO_HAND",
        payload: {
          playerId: "player-2",
          sourceZone: "shield",
          revealToOpponent: true,
        },
        currentPlayerId: "player-1",
      }),
    ).toEqual({
      visible: false,
      reason: "hidden",
    });
  });

  test("still shows opponent burst-origin add-to-hand popup", () => {
    expect(
      resolveCardAddedToHandView({
        eventType: "CARD_ADDED_TO_HAND",
        payload: {
          playerId: "player-2",
          sourceZone: "shield",
          reason: "burst",
        },
        currentPlayerId: "player-1",
      }),
    ).toEqual({
      visible: true,
      mode: "opponent_burst",
      title: "Burst - Opponent added card to hand",
    });
  });
});
