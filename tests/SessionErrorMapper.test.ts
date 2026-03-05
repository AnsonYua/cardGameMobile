import { describe, expect, it } from "vitest";
import { mapSessionInitError } from "../src/phaser/controllers/SessionErrorMapper";
import { GameMode } from "../src/phaser/game/GameSessionService";

const baseParsed = {
  mode: GameMode.Join,
  gameId: "game_1",
  player: "currentPlayer" as const,
  hasPlayerOverride: false,
  allowSeatSessionFallback: false,
  playerName: null,
  joinToken: null,
  isAutoPolling: true,
  aiMode: false,
};

describe("mapSessionInitError", () => {
  it("maps errorCode-based responses to expected dialogs", () => {
    const expired = mapSessionInitError(
      { status: 401, message: "Invalid session", data: { errorCode: "SESSION_EXPIRED" } },
      baseParsed,
    );
    expect(expired.headerText).toBe("Can't Reconnect Session");
    expect(expired.message).toBe("Your saved game session is no longer valid on this browser.");
    expect(expired.actions.map((item) => item.label)).toEqual(["Go Lobby", "Create New Room"]);
    expect(expired.allowOfflineFallback).toBe(false);

    const joinTokenInvalid = mapSessionInitError(
      { status: 403, message: "bad token", data: { errorCode: "JOIN_TOKEN_INVALID" } },
      baseParsed,
    );
    expect(joinTokenInvalid.headerText).toBe("Invalid Invite Link");
    expect(joinTokenInvalid.actions.map((item) => item.label)).toEqual(["Go Lobby"]);

    const roomFull = mapSessionInitError({ status: 409, message: "full", data: { errorCode: "ROOM_FULL" } }, baseParsed);
    expect(roomFull.headerText).toBe("Room Already Full");

    const started = mapSessionInitError(
      { status: 409, message: "started", data: { errorCode: "MATCH_ALREADY_STARTED" } },
      baseParsed,
    );
    expect(started.headerText).toBe("Match Already Started");

    const seatBlocked = mapSessionInitError(
      { status: 403, message: "disabled", data: { errorCode: "SEAT_SWITCH_DISABLED" } },
      baseParsed,
    );
    expect(seatBlocked.headerText).toBe("Seat Switch Blocked");

    const notFound = mapSessionInitError(
      { status: 404, message: "missing", data: { errorCode: "ROOM_NOT_FOUND" } },
      baseParsed,
    );
    expect(notFound.headerText).toBe("Room Not Found");
  });

  it("maps legacy messages to required heuristics", () => {
    const full = mapSessionInitError({ status: 409, message: "Game is full" }, baseParsed);
    expect(full.headerText).toBe("Room Already Full");

    const started = mapSessionInitError({ status: 409, message: "Room is not available for joining" }, baseParsed);
    expect(started.headerText).toBe("Match Already Started");

    const expired = mapSessionInitError({ status: 401, message: "Invalid or expired session token" }, baseParsed);
    expect(expired.headerText).toBe("Can't Reconnect Session");
  });

  it("maps network/server failures to retry dialog and offline fallback", () => {
    const network = mapSessionInitError(new TypeError("Failed to fetch"), baseParsed);
    expect(network.headerText).toBe("Connection Problem");
    expect(network.message).toBe("Couldn't reach the game server.");
    expect(network.actions.map((item) => item.label)).toEqual(["Retry", "Go Lobby"]);
    expect(network.allowOfflineFallback).toBe(true);

    const server = mapSessionInitError({ status: 503, message: "service unavailable" }, baseParsed);
    expect(server.allowOfflineFallback).toBe(true);
    expect(server.actions[0]?.reload).toBe(true);
  });
});
