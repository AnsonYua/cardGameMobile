import { describe, expect, test, vi } from "vitest";
import { MatchSyncController } from "./MatchSyncController";

function createScene() {
  return {
    time: {
      addEvent: vi.fn(({ delay, loop, callback }) => ({
        delay,
        loop,
        callback,
        remove: vi.fn(),
      })),
    },
  };
}

describe("MatchSyncController", () => {
  test("starts passive polling only when auto polling is enabled", () => {
    const scene = createScene();
    const controller = new MatchSyncController({
      scene: scene as any,
      engine: { updateGameStatus: vi.fn() } as any,
      contextStore: {
        get: vi.fn(() => ({
          gameId: "game_1",
          playerId: "player_1",
          isAutoPolling: true,
        })),
      } as any,
      isAnimationQueueRunning: () => false,
    });

    controller.start();

    expect(scene.time.addEvent).toHaveBeenCalledTimes(1);
    expect(scene.time.addEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        delay: 1000,
        loop: true,
      }),
    );
  });

  test("does not poll while animation queue is running and flushes once on idle", async () => {
    const scene = createScene();
    const updateGameStatus = vi.fn(async () => undefined);
    const onRefreshComplete = vi.fn();
    let queueRunning = true;
    const controller = new MatchSyncController({
      scene: scene as any,
      engine: { updateGameStatus } as any,
      contextStore: {
        get: vi.fn(() => ({
          gameId: "game_1",
          playerId: "player_1",
          isAutoPolling: true,
        })),
      } as any,
      isAnimationQueueRunning: () => queueRunning,
      onRefreshComplete,
    });

    controller.start();
    const timerEvent = (scene.time.addEvent as any).mock.results[0].value;

    await timerEvent.callback();
    expect(updateGameStatus).not.toHaveBeenCalled();

    queueRunning = false;
    await controller.flushDeferredPoll();

    expect(updateGameStatus).toHaveBeenCalledTimes(1);
    expect(updateGameStatus).toHaveBeenCalledWith("game_1", "player_1");
    expect(onRefreshComplete).toHaveBeenCalledTimes(1);
  });

  test("stops cleanly", () => {
    const scene = createScene();
    const controller = new MatchSyncController({
      scene: scene as any,
      engine: { updateGameStatus: vi.fn() } as any,
      contextStore: {
        get: vi.fn(() => ({
          gameId: "game_1",
          playerId: "player_1",
          isAutoPolling: true,
        })),
      } as any,
      isAnimationQueueRunning: () => false,
    });

    controller.start();
    const timerEvent = (scene.time.addEvent as any).mock.results[0].value;

    controller.stop();

    expect(timerEvent.remove).toHaveBeenCalledTimes(1);
  });
});
