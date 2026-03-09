import { describe, expect, test } from "vitest";
import { resolveShareGameInviteUrl } from "./shareGameInvite";

describe("resolveShareGameInviteUrl", () => {
  test("builds a join link when the current game has an invite token", () => {
    expect(
      resolveShareGameInviteUrl({
        gameId: "room_1",
        joinToken: "token_1",
        joinUrlBase: "http://localhost:5173",
      }),
    ).toBe("http://localhost:5173/game?mode=join&gameId=room_1&isAutoPolling=true&joinToken=token_1");
  });

  test("returns null when the invite token is missing", () => {
    expect(
      resolveShareGameInviteUrl({
        gameId: "room_1",
        joinToken: null,
        joinUrlBase: "http://localhost:5173",
      }),
    ).toBeNull();
  });
});
