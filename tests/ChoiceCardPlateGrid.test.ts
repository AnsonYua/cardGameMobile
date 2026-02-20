import { describe, expect, it } from "vitest";
import { computeChoiceCardPlateGridLayout } from "../src/phaser/ui/choice/ChoiceCardPlateGrid";

describe("ChoiceCardPlateGrid", () => {
  it("computes bounded cell width and rows", () => {
    const layout = computeChoiceCardPlateGridLayout({
      itemCount: 5,
      maxContentWidth: 540,
      cardAspect: 88 / 64,
      colsMax: 3,
      gap: 12,
      minCellWidth: 96,
      maxCellWidth: 170,
      extraCellHeight: 36,
    });

    expect(layout.cols).toBe(3);
    expect(layout.rows).toBe(2);
    expect(layout.cellWidth).toBeLessThanOrEqual(170);
    expect(layout.cellWidth).toBeGreaterThanOrEqual(96);
  });
});
