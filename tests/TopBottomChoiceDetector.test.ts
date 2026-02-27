import { describe, expect, it } from "vitest";
import { detectTopBottomDecision } from "../src/phaser/controllers/choice/TopBottomChoiceDetector";

describe("detectTopBottomDecision", () => {
  it("detects TOP/BOTTOM by action with card preview", () => {
    const result = detectTopBottomDecision([
      {
        index: 0,
        label: "Top",
        action: "TOP",
        mode: "card",
        cardId: "GD01-001",
        enabled: true,
      },
      {
        index: 1,
        label: "Bottom",
        action: "BOTTOM",
        mode: "card",
        cardId: "GD01-001",
        enabled: true,
      },
    ]);

    expect(result).toMatchObject({
      topIndex: 0,
      bottomIndex: 1,
      topLabel: "Top",
      bottomLabel: "Bottom",
    });
    expect(result?.cardChoice.cardId).toBe("GD01-001");
  });

  it("detects TOP/BOTTOM by label", () => {
    const result = detectTopBottomDecision([
      {
        index: 2,
        label: "Put it on top",
        mode: "card",
        cardId: "GD01-029",
      },
      {
        index: 3,
        label: "Put it on the bottom of your deck",
        mode: "card",
        cardId: "GD01-029",
      },
    ]);

    expect(result).toBeTruthy();
    expect(result?.topIndex).toBe(2);
    expect(result?.bottomIndex).toBe(3);
  });

  it("returns undefined for text-only top/bottom choices", () => {
    const result = detectTopBottomDecision([
      { index: 0, label: "Top", action: "TOP", mode: "text" },
      { index: 1, label: "Bottom", action: "BOTTOM", mode: "text" },
    ]);

    expect(result).toBeUndefined();
  });

  it("returns undefined when not strict top/bottom set", () => {
    const result = detectTopBottomDecision([
      { index: 0, label: "Keep", mode: "card", cardId: "GD01-001" },
      { index: 1, label: "Discard", mode: "card", cardId: "GD01-001" },
    ]);

    expect(result).toBeUndefined();
  });
});
