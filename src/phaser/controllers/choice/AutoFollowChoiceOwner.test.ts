import { describe, expect, test, vi } from "vitest";
import { autoFollowChoiceOwner } from "./AutoFollowChoiceOwner";

describe("autoFollowChoiceOwner", () => {
  test("switches seat once and updates session/context for opponent-owned unresolved choice", async () => {
    const resolveSeatSession = vi.fn(async () => ({
      success: true,
      resolvedPlayerId: "playerId_2",
      sessionToken: "session_token_2",
      sessionExpiresAt: 12345,
    }));
    const updateSession = vi.fn();
    const updateContext = vi.fn();
    const refreshGameStatus = vi.fn(async () => undefined);
    const refreshActions = vi.fn();
    const log = { warn: vi.fn() };
    const attemptedChoiceIds = new Set<string>();
    const raw = {
      gameEnv: {
        currentPlayer: "playerId_1",
        notificationQueue: [
          {
            id: "blocker_choice_1",
            type: "BLOCKER_CHOICE",
            payload: {
              event: {
                id: "blocker_choice_1",
                type: "BLOCKER_CHOICE",
                playerId: "playerId_2",
                status: "DECLARED",
                data: { userDecisionMade: false },
              },
            },
          },
        ],
      },
    };

    const result = await autoFollowChoiceOwner({
      enabled: true,
      inFlight: false,
      raw,
      gameId: "game_1",
      selfPlayerId: "playerId_1",
      attemptedChoiceIds,
      resolveSeatSession,
      updateSession,
      updateContext,
      refreshGameStatus,
      refreshActions,
      log,
    });

    expect(result.switched).toBe(true);
    expect(resolveSeatSession).toHaveBeenCalledTimes(1);
    expect(resolveSeatSession).toHaveBeenCalledWith("game_1", "opponent");
    expect(updateSession).toHaveBeenCalledWith({
      gameId: "game_1",
      playerId: "playerId_2",
      sessionToken: "session_token_2",
      sessionExpiresAt: 12345,
    });
    expect(updateContext).toHaveBeenCalledWith({
      playerId: "playerId_2",
      playerSelector: "opponent",
    });
    expect(refreshGameStatus).toHaveBeenCalledWith("game_1", "playerId_2");
    expect(refreshActions).toHaveBeenCalledTimes(1);
    expect(attemptedChoiceIds.has("blocker_choice_1")).toBe(true);
  });

  test("does not switch again after the same choice id was already attempted", async () => {
    const resolveSeatSession = vi.fn(async () => ({
      success: true,
      resolvedPlayerId: "playerId_2",
      sessionToken: "session_token_2",
    }));
    const raw = {
      gameEnv: {
        currentPlayer: "playerId_1",
        notificationQueue: [
          {
            id: "blocker_choice_1",
            type: "BLOCKER_CHOICE",
            payload: {
              event: {
                id: "blocker_choice_1",
                type: "BLOCKER_CHOICE",
                playerId: "playerId_2",
                status: "DECLARED",
                data: { userDecisionMade: false },
              },
            },
          },
        ],
      },
    };

    const result = await autoFollowChoiceOwner({
      enabled: true,
      inFlight: false,
      raw,
      gameId: "game_1",
      selfPlayerId: "playerId_1",
      attemptedChoiceIds: new Set<string>(["blocker_choice_1"]),
      resolveSeatSession,
      updateSession: vi.fn(),
      updateContext: vi.fn(),
      refreshGameStatus: vi.fn(async () => undefined),
      refreshActions: vi.fn(),
      log: { warn: vi.fn() },
    });

    expect(result.switched).toBe(false);
    expect(resolveSeatSession).not.toHaveBeenCalled();
  });
});
