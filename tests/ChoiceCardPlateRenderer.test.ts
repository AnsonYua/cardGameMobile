import { describe, expect, it } from "vitest";
import { getChoiceCardPlateVisual } from "../src/phaser/ui/choice/ChoiceCardPlateRenderer";

describe("ChoiceCardPlateRenderer visual states", () => {
  it("uses selectable affordance for selectable cards", () => {
    const visual = getChoiceCardPlateVisual("selectable", true);
    expect(visual.interactive).toBe(true);
    expect(visual.hint).toBe("Tap card to select");
    expect(visual.border).toBe(0x8ea8ff);
  });

  it("uses read-only affordance for reveal-only cards", () => {
    const visual = getChoiceCardPlateVisual("read_only", true);
    expect(visual.interactive).toBe(false);
    expect(visual.hint).toBe("Review only");
    expect(visual.border).toBe(0x5b6068);
  });
});
