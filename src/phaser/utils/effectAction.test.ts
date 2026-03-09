import { describe, expect, test } from "vitest";
import { getLegacyAction, isPilotDesignationRule } from "./effectAction";

describe("effectAction", () => {
  test("prefers compiled effect node fields when present", () => {
    expect(
      getLegacyAction({
        action: "damage",
        compiledEffectNode: {
          structure: "sequence",
        },
      }),
    ).toBe("sequence");

    expect(
      getLegacyAction({
        compiledEffectNode: {
          structure: "primitive",
          playMode: "designate_pilot",
        },
      }),
    ).toBe("designate_pilot");

    expect(
      getLegacyAction({
        compiledEffectNode: {
          structure: "primitive",
          metaRef: { type: "activate_ability", abilityType: "main" },
        },
      }),
    ).toBe("activate_ability");
  });

  test("detects pilot designation from compiled or legacy rule shapes", () => {
    expect(
      isPilotDesignationRule({
        compiledEffectNode: {
          structure: "primitive",
          playMode: "designate_pilot",
        },
      }),
    ).toBe(true);

    expect(
      isPilotDesignationRule({
        effectId: "pilot_designation",
      }),
    ).toBe(true);

    expect(
      isPilotDesignationRule({
        action: "designate_pilot",
      }),
    ).toBe(true);

    expect(
      isPilotDesignationRule({
        action: "damage",
      }),
    ).toBe(false);
  });
});
