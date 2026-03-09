import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  submitDeckFromStorage: vi.fn(async () => ({ deckCount: 0 })),
  updateSession: vi.fn(),
}));

vi.mock("../game/deckSubmissionFlow", () => ({
  submitDeckFromStorage: mocks.submitDeckFromStorage,
}));

vi.mock("../game/SessionStore", () => ({
  updateSession: mocks.updateSession,
}));

import { runJoinFlow } from "./sessionFlows";

describe("runJoinFlow", () => {
  beforeEach(() => {
    mocks.submitDeckFromStorage.mockClear();
    mocks.updateSession.mockClear();
  });

  test("falls back to resolveSeatSession for scenario opponent links", async () => {
    const joinRoom = vi.fn(async () => {
      throw new Error("Room is not available for joining");
    });
    const resolveSeatSession = vi.fn(async () => ({
      success: true,
      resolvedPlayerId: "playerId_2",
      sessionToken: "seat-session-token",
      sessionExpiresAt: 123456,
    }));
    const submitDeck = vi.fn(async () => ({ success: true }));
    const getGameStatus = vi.fn(async () => ({ raw: { ok: true } }));
    const contextStore = {
      get: vi.fn(() => ({ playerId: null })),
      update: vi.fn(),
    };
    const engine = {
      setAllowEnvScanFallbackDefault: vi.fn(),
      updateGameStatus: vi.fn(async () => undefined),
    };
    const debugControls = {
      setScenarioResourceFallbackEnabled: vi.fn(),
      startAutoPolling: vi.fn(async () => undefined),
    };
    const match = {
      joinRoom,
      resolveSeatSession,
      adoptJoinSession: vi.fn(),
      submitDeck,
      getGameStatus,
    };

    await runJoinFlow(
      { match: match as any, engine: engine as any, contextStore: contextStore as any, debugControls: debugControls as any },
      {
        gameId: "scenario_1",
        playerSelector: "opponent",
        hasPlayerOverride: true,
        allowSeatSessionFallback: true,
        isAutoPolling: true,
      },
    );

    expect(joinRoom).toHaveBeenCalledWith("scenario_1", undefined);
    expect(resolveSeatSession).toHaveBeenCalledWith("scenario_1", "opponent");
    expect(mocks.updateSession).toHaveBeenCalledWith({
      gameId: "scenario_1",
      playerId: "playerId_2",
      sessionToken: "seat-session-token",
      sessionExpiresAt: 123456,
    });
    expect(match.adoptJoinSession).toHaveBeenCalledWith("scenario_1");
    expect(engine.setAllowEnvScanFallbackDefault).toHaveBeenCalledWith(true);
    expect(debugControls.setScenarioResourceFallbackEnabled).toHaveBeenCalledWith(true);
    expect(mocks.submitDeckFromStorage).toHaveBeenCalledTimes(1);
    expect(getGameStatus).toHaveBeenCalledWith("scenario_1", "playerId_2");
    expect(debugControls.startAutoPolling).toHaveBeenCalledTimes(1);
  });
});
