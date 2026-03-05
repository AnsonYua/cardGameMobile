import { beforeEach, describe, expect, it, vi } from "vitest";
import { SessionController } from "../src/phaser/controllers/SessionController";
import { GameMode } from "../src/phaser/game/GameSessionService";

const runJoinFlowMock = vi.fn();
const runHostFlowMock = vi.fn();

vi.mock("../src/phaser/controllers/sessionFlows", () => ({
  runJoinFlow: (...args: any[]) => runJoinFlowMock(...args),
  runHostFlow: (...args: any[]) => runHostFlowMock(...args),
}));

describe("SessionController init error routing", () => {
  beforeEach(() => {
    runJoinFlowMock.mockReset();
    runHostFlowMock.mockReset();
  });

  it("routes 4xx join/session errors to onSessionInitError", async () => {
    runJoinFlowMock.mockRejectedValue({
      name: "ApiError",
      status: 403,
      message: "Join token invalid",
      data: { errorCode: "JOIN_TOKEN_INVALID" },
    });

    const onSessionInitError = vi.fn();
    const onOfflineFallback = vi.fn();
    const contextStore = {
      update: vi.fn(),
      get: vi.fn(() => ({ mode: GameMode.Join })),
    } as any;

    const controller = new SessionController({
      match: {} as any,
      engine: {} as any,
      contextStore,
      debugControls: undefined,
      onSessionInitError,
      onOfflineFallback,
    });

    await controller.initSession("?mode=join&gameId=game_1&joinToken=bad_token");

    expect(onSessionInitError).toHaveBeenCalledTimes(1);
    expect(onOfflineFallback).not.toHaveBeenCalled();
  });

  it("routes network/5xx errors to offline fallback", async () => {
    runJoinFlowMock.mockRejectedValue({
      name: "ApiError",
      status: 503,
      message: "Service unavailable",
      data: { errorCode: "INTERNAL_ERROR" },
    });

    const onSessionInitError = vi.fn();
    const onOfflineFallback = vi.fn();
    const contextStore = {
      update: vi.fn(),
      get: vi.fn(() => ({ mode: GameMode.Join })),
    } as any;

    const controller = new SessionController({
      match: {} as any,
      engine: {} as any,
      contextStore,
      debugControls: undefined,
      onSessionInitError,
      onOfflineFallback,
    });

    await controller.initSession("?mode=join&gameId=game_2&joinToken=token");

    expect(onOfflineFallback).toHaveBeenCalledTimes(1);
    expect(onOfflineFallback.mock.calls[0]?.[0]).toBe("game_2");
    expect(onSessionInitError).not.toHaveBeenCalled();
  });
});
