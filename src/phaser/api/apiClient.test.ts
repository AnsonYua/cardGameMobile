import { beforeEach, describe, expect, test, vi } from "vitest";
import { ApiClient } from "./apiClient";
import { clearSession, getSession, updateSession } from "../game/SessionStore";

describe("ApiClient seat session recovery", () => {
  beforeEach(() => {
    clearSession();
    vi.restoreAllMocks();
  });

  test("refreshes scenario seat session and retries once on SESSION_EXPIRED", async () => {
    updateSession({
      gameId: "scenario_1",
      playerId: "playerId_2",
      sessionToken: "stale-token",
      sessionExpiresAt: 1,
    });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        json: async () => ({
          errorCode: "SESSION_EXPIRED",
          error: "Invalid or expired session token",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          gameId: "scenario_1",
          resolvedPlayerId: "playerId_2",
          sessionToken: "fresh-token",
          sessionExpiresAt: 999999,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: "ok" }),
      });

    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("window", {
      location: {
        origin: "http://localhost:5173",
        search: "?mode=join&gameId=scenario_1&player=opponent&allowSeatSessionFallback=1",
      },
    });

    const client = new ApiClient("http://localhost:8080");
    const response = await client.postJson("/api/game/player/endTurn", { gameId: "scenario_1", playerId: "playerId_2" }, { auth: true });

    expect(response).toEqual({ success: true, data: "ok" });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0]?.[1]?.headers?.Authorization).toBe("Bearer stale-token");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("http://localhost:8080/api/game/test/resolveSeatSession");
    expect(fetchMock.mock.calls[2]?.[1]?.headers?.Authorization).toBe("Bearer fresh-token");
    expect(getSession().sessionToken).toBe("fresh-token");
  });
});
