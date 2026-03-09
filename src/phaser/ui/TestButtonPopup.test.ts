import { describe, expect, test } from "vitest";
import { buildLobbyJoinUrl, buildScenarioSeatUrl } from "./gameUrlBuilders";

describe("TestButtonPopup URL builders", () => {
  test("builds normal lobby join links without seat-session params", () => {
    const url = buildLobbyJoinUrl({
      base: "http://localhost:5173",
      gameId: "room_1",
      joinToken: "token_1",
      isAutoPolling: true,
    });

    expect(url).toBe("http://localhost:5173/game?mode=join&gameId=room_1&isAutoPolling=true&joinToken=token_1");
  });

  test("builds opponent scenario links with seat-session fallback params", () => {
    const url = buildScenarioSeatUrl({
      base: "http://localhost:5173",
      gameId: "scenario_1",
      player: "opponent",
      isAutoPolling: true,
    });

    expect(url).toBe(
      "http://localhost:5173/game?mode=join&gameId=scenario_1&isAutoPolling=true&player=opponent&allowSeatSessionFallback=1",
    );
  });
});
