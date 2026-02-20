import { describe, expect, it } from "vitest";
import { withTutorRevealStepHeader, withTutorSelectionStepHeader } from "../src/phaser/controllers/choice/TutorStepHeader";

describe("TutorStepHeader", () => {
  it("adds step marker to reveal prompt header", () => {
    const header = withTutorRevealStepHeader("Top of Deck", { kind: "TUTOR_TOP_DECK_REVEAL_CONFIRM" });
    expect(header).toBe("Top of Deck (Step 1/2)");
  });

  it("adds step marker to tutor selection header", () => {
    const header = withTutorSelectionStepHeader("Destroyed Effect", { tutor: { lookedCarduids: ["a"] } });
    expect(header).toBe("Destroyed Effect (Step 2/2)");
  });
});
