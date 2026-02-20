import { describe, expect, it } from "vitest";
import { resolveOptionChoiceLayout } from "../src/phaser/controllers/choice/OptionChoiceLayoutResolver";

describe("resolveOptionChoiceLayout", () => {
  it("returns hint when provided", () => {
    expect(resolveOptionChoiceLayout([{ index: 0, mode: "card", cardId: "ST03-001" }], "text")).toBe("text");
  });

  it("infers hybrid for mixed card/text choices", () => {
    const layout = resolveOptionChoiceLayout([
      { index: 0, mode: "card", cardId: "ST03-001" },
      { index: 1, mode: "text", label: "Bottom" },
    ]);
    expect(layout).toBe("hybrid");
  });

  it("infers text for choices without card ids", () => {
    const layout = resolveOptionChoiceLayout([{ index: 0, label: "Bottom" }]);
    expect(layout).toBe("text");
  });
});
