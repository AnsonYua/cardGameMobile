import { describe, expect, test } from "vitest";
import {
  getCompiledTiming,
  getEffectActivationWindows,
  getEffectEventTrigger,
  hasEffectActivationWindow,
} from "./effectTiming";

describe("effectTiming", () => {
  test("prefers compiled timing fields when present", () => {
    const rule = {
      type: "activated",
      trigger: "MAIN_PHASE",
      compiledTiming: {
        activationWindows: ["ACTION_STEP"],
        timingClass: "player_activated",
      },
      timing: {
        activationWindows: ["MAIN_PHASE"],
      },
    };

    expect(getCompiledTiming(rule)?.timingClass).toBe("player_activated");
    expect(getEffectActivationWindows(rule)).toEqual(["ACTION_STEP", "MAIN_PHASE"]);
    expect(hasEffectActivationWindow(rule, "ACTION_STEP")).toBe(true);
  });

  test("reads explicit event triggers from compiled timing or timing.eventTrigger", () => {
    expect(
      getEffectEventTrigger({
        compiledTiming: { eventTrigger: "BURST_CONDITION", timingClass: "event_triggered" },
      }),
    ).toBe("BURST_CONDITION");

    expect(
      getEffectEventTrigger({
        timing: { eventTrigger: "ENTERS_PLAY" },
      }),
    ).toBe("ENTERS_PLAY");
  });

  test("keeps MAIN_PHASE as the compatibility default for play, activated, and designate_pilot rules", () => {
    expect(
      getEffectActivationWindows({
        type: "play",
        action: "damage",
      }),
    ).toEqual(["MAIN_PHASE"]);

    expect(
      getEffectActivationWindows({
        type: "activated",
        action: "damage",
      }),
    ).toEqual(["MAIN_PHASE"]);

    expect(
      getEffectActivationWindows({
        type: "special",
        action: "designate_pilot",
      }),
    ).toEqual(["MAIN_PHASE"]);
  });

  test("does not treat non-window event triggers as activation windows", () => {
    const rule = {
      type: "triggered",
      compiledTiming: {
        eventTrigger: "BURST_CONDITION",
        timingClass: "event_triggered",
      },
    };

    expect(getEffectEventTrigger(rule)).toBe("BURST_CONDITION");
    expect(getEffectActivationWindows(rule)).toEqual([]);
    expect(hasEffectActivationWindow(rule, "MAIN_PHASE")).toBe(false);
  });
});
