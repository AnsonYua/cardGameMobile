import { describe, expect, it } from "vitest";
import { evaluateComparisonFilter } from "../src/phaser/utils/comparisonFilter";

describe("comparisonFilter", () => {
  it("supports static numeric comparisons including != and =", () => {
    expect(evaluateComparisonFilter(5, "<=5")).toBe(true);
    expect(evaluateComparisonFilter(5, "=5")).toBe(true);
    expect(evaluateComparisonFilter(5, "==5")).toBe(true);
    expect(evaluateComparisonFilter(5, "!=5")).toBe(false);
    expect(evaluateComparisonFilter(5, "!=4")).toBe(true);
  });

  it("supports dynamic token comparisons (SOURCE_AP, SOURCE_LEVEL, camelCase)", () => {
    expect(evaluateComparisonFilter(4, "<=SOURCE_AP", { SOURCE_AP: 4 })).toBe(true);
    expect(evaluateComparisonFilter(5, "<=SOURCE_AP", { SOURCE_AP: 4 })).toBe(false);
    expect(evaluateComparisonFilter(3, "<=sourceLevel", { sourceLevel: 3 })).toBe(true);
    expect(evaluateComparisonFilter(4, "<=sourceLevel", { sourceLevel: 3 })).toBe(false);
  });

  it("returns false for invalid filters", () => {
    expect(evaluateComparisonFilter(4, "SOURCE_AP", { SOURCE_AP: 4 })).toBe(false);
    expect(evaluateComparisonFilter(4, "<=SOURCE_HP", { SOURCE_AP: 4 })).toBe(false);
    expect(evaluateComparisonFilter(4, "<=abc")).toBe(false);
  });
});
