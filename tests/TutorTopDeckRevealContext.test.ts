import { describe, expect, it } from "vitest";
import {
  getTutorStep2EligibilityHint,
  getTutorTopDeckRevealCards,
  isTutorTopDeckRevealPrompt,
} from "../src/phaser/controllers/choice/TutorTopDeckRevealContext";

describe("TutorTopDeckRevealContext", () => {
  it("detects tutor reveal prompt kind", () => {
    expect(isTutorTopDeckRevealPrompt({ kind: "TUTOR_TOP_DECK_REVEAL_CONFIRM" })).toBe(true);
    expect(isTutorTopDeckRevealPrompt({ kind: "OTHER" })).toBe(false);
  });

  it("extracts looked cards safely", () => {
    const context = {
      kind: "TUTOR_TOP_DECK_REVEAL_CONFIRM",
      tutor: {
        lookedCards: [
          { carduid: "a", cardId: "ST03-001", name: "Sinanju", matchesFilters: true },
          { carduid: "b", cardId: "GD03-109", name: "Improved Technique", matchesFilters: false },
        ],
      },
    };
    const cards = getTutorTopDeckRevealCards(context);
    expect(cards).toHaveLength(2);
    expect(cards[0].interactionState).toBe("read_only");
    expect(cards[0].step2Eligible).toBe(true);
    expect(cards[1].step2Eligible).toBe(false);
    expect(getTutorStep2EligibilityHint(cards[0])).toBe("Eligible in Step 2");
    expect(getTutorStep2EligibilityHint(cards[1])).toBe("Not eligible in Step 2");
    expect(getTutorTopDeckRevealCards({ kind: "TUTOR_TOP_DECK_REVEAL_CONFIRM" })).toEqual([]);
  });
});
