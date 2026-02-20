import { describe, expect, it } from "vitest";
import { getTutorTopDeckRevealCards, isTutorTopDeckRevealPrompt } from "../src/phaser/controllers/choice/TutorTopDeckRevealContext";

describe("TutorTopDeckRevealContext", () => {
  it("detects tutor reveal prompt kind", () => {
    expect(isTutorTopDeckRevealPrompt({ kind: "TUTOR_TOP_DECK_REVEAL_CONFIRM" })).toBe(true);
    expect(isTutorTopDeckRevealPrompt({ kind: "OTHER" })).toBe(false);
  });

  it("extracts looked cards safely", () => {
    const context = {
      kind: "TUTOR_TOP_DECK_REVEAL_CONFIRM",
      tutor: {
        lookedCards: [{ carduid: "a", cardId: "ST03-001", name: "Sinanju" }],
      },
    };
    expect(getTutorTopDeckRevealCards(context)).toHaveLength(1);
    expect(getTutorTopDeckRevealCards({ kind: "TUTOR_TOP_DECK_REVEAL_CONFIRM" })).toEqual([]);
  });
});
