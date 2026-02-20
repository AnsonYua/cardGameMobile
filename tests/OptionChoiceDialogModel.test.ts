import { describe, expect, it } from "vitest";
import { normalizeOptionChoices } from "../src/phaser/ui/optionChoice/OptionChoiceDialogModel";

describe("normalizeOptionChoices interaction state", () => {
  it("maps enabled card options to selectable state", () => {
    const out = normalizeOptionChoices([{ index: 0, mode: "card", cardId: "ST03-001", enabled: true }]);
    expect(out[0].interactionState).toBe("selectable");
  });

  it("keeps text options read-only and card disabled options read-only", () => {
    const out = normalizeOptionChoices([
      { index: 0, mode: "card", cardId: "ST03-001", enabled: false },
      { index: 1, mode: "text", label: "Bottom", enabled: true },
    ]);
    expect(out[0].interactionState).toBe("read_only");
    expect(out[1].interactionState).toBe("read_only");
  });
});
