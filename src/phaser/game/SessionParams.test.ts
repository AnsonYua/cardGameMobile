import { describe, expect, test } from "vitest";
import { parseSessionParams } from "./SessionParams";

describe("parseSessionParams", () => {
  test("parses scenario seat-session params for opponent links", () => {
    const parsed = parseSessionParams("?mode=join&gameId=scenario_1&player=opponent&allowSeatSessionFallback=1&isAutoPolling=1");

    expect(parsed.mode).toBe("join");
    expect(parsed.gameId).toBe("scenario_1");
    expect(parsed.player).toBe("opponent");
    expect(parsed.hasPlayerOverride).toBe(true);
    expect(parsed.allowSeatSessionFallback).toBe(true);
    expect(parsed.isAutoPolling).toBe(true);
  });
});
