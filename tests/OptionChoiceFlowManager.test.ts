import { describe, expect, it } from "vitest";
import { resolveOptionChoiceTimeoutIndex } from "../src/phaser/controllers/OptionChoiceFlowManager";

describe("resolveOptionChoiceTimeoutIndex", () => {
  it("uses explicit defaultOptionIndex when enabled", () => {
    const options = [
      { index: 0, label: "A", enabled: true },
      { index: 1, label: "Bottom", payload: { action: "BOTTOM" }, enabled: true },
    ];

    expect(resolveOptionChoiceTimeoutIndex(options, 0)).toBe(0);
  });

  it("falls back to BOTTOM option when defaultOptionIndex is invalid", () => {
    const options = [
      { index: 0, label: "A", enabled: true },
      { index: 1, label: "Put it on the bottom of your deck", payload: { action: "BOTTOM" }, enabled: true },
    ];

    expect(resolveOptionChoiceTimeoutIndex(options, 9)).toBe(1);
  });

  it("falls back to first enabled option", () => {
    const options = [
      { index: 0, label: "Disabled", enabled: false },
      { index: 1, label: "Enabled", enabled: true },
    ];

    expect(resolveOptionChoiceTimeoutIndex(options)).toBe(1);
  });
});
