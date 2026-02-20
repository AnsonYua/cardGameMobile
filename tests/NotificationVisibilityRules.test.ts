import { describe, expect, it } from "vitest";
import { resolveCardAddedToHandView } from "../src/phaser/animations/NotificationVisibilityRules";

describe("resolveCardAddedToHandView", () => {
  it("shows self add-to-hand", () => {
    const result = resolveCardAddedToHandView({
      eventType: "CARD_ADDED_TO_HAND",
      payload: { playerId: "p1" },
      currentPlayerId: "p1",
    });
    expect(result).toEqual({ visible: true, mode: "self", title: "Card Added to Hand" });
  });

  it("shows opponent burst reveal", () => {
    const result = resolveCardAddedToHandView({
      eventType: "CARD_ADDED_TO_HAND",
      payload: { playerId: "p2", reason: "burst" },
      currentPlayerId: "p1",
    });
    expect(result).toEqual({
      visible: true,
      mode: "opponent_burst",
      title: "Burst - Opponent added card to hand",
    });
  });

  it("shows opponent tutor reveal", () => {
    const result = resolveCardAddedToHandView({
      eventType: "CARD_ADDED_TO_HAND",
      payload: { playerId: "p2", revealToOpponent: true },
      currentPlayerId: "p1",
    });
    expect(result).toEqual({
      visible: true,
      mode: "opponent_reveal",
      title: "Opponent Revealed Card Added to Hand",
    });
  });

  it("hides non-revealed opponent add-to-hand", () => {
    const result = resolveCardAddedToHandView({
      eventType: "CARD_ADDED_TO_HAND",
      payload: { playerId: "p2" },
      currentPlayerId: "p1",
    });
    expect(result.visible).toBe(false);
  });
});
