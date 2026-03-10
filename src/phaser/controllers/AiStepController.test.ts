import { describe, expect, test, vi } from "vitest";
import { AiStepController } from "./AiStepController";

function createScene() {
  return {
    time: {
      addEvent: vi.fn(({ delay, callback }) => ({
        delay,
        callback,
        remove: vi.fn(),
      })),
    },
  };
}

describe("AiStepController", () => {
  test("advances one AI step after animation idle in AI matches", async () => {
    const scene = createScene();
    const api = {
      advanceAiStep: vi.fn(async () => ({
        success: true,
        gameEnv: { aiPlayerIds: ["player_ai"] },
        aiAutoplay: { isAiMatch: true, hasMoreAiWork: false, throttleWaitMs: 0 },
      })),
    };
    const engine = {
      getSnapshot: vi.fn(() => ({
        raw: {
          aiAutoplay: { hasMoreAiWork: true, throttleWaitMs: 0 },
          gameEnv: { aiPlayerIds: ["player_ai"] },
        },
      })),
      updateGameStatus: vi.fn(async () => undefined),
    };
    const contextStore = {
      get: vi.fn(() => ({
        gameId: "game_1",
        playerId: "player_human",
        isAutoPolling: true,
        isAiMatch: true,
      })),
    };

    const controller = new AiStepController({
      scene: scene as any,
      api: api as any,
      engine: engine as any,
      contextStore: contextStore as any,
      isAnimationQueueRunning: () => false,
    });

    controller.handleAnimationQueueIdle();
    await Promise.resolve();
    await Promise.resolve();

    expect(api.advanceAiStep).toHaveBeenCalledWith({
      gameId: "game_1",
      playerId: "player_human",
    });
    expect(engine.updateGameStatus).toHaveBeenCalledWith("game_1", "player_human", {
      statusPayload: expect.any(Object),
      silent: false,
    });
  });

  test("does not advance while the human owns an unresolved prompt", async () => {
    const scene = createScene();
    const api = {
      advanceAiStep: vi.fn(async () => ({})),
    };
    const engine = {
      getSnapshot: vi.fn(() => ({
        raw: {
          aiAutoplay: { hasMoreAiWork: true, throttleWaitMs: 0 },
          gameEnv: {
            aiPlayerIds: ["player_ai"],
            notificationQueue: [
              {
                id: "choice_1",
                type: "TARGET_CHOICE",
                payload: {
                  event: {
                    id: "choice_1",
                    type: "TARGET_CHOICE",
                    playerId: "player_human",
                  },
                },
              },
            ],
          },
        },
      })),
      updateGameStatus: vi.fn(async () => undefined),
    };
    const contextStore = {
      get: vi.fn(() => ({
        gameId: "game_1",
        playerId: "player_human",
        isAutoPolling: true,
        isAiMatch: true,
      })),
    };

    const controller = new AiStepController({
      scene: scene as any,
      api: api as any,
      engine: engine as any,
      contextStore: contextStore as any,
      isAnimationQueueRunning: () => false,
    });

    controller.handleAnimationQueueIdle();
    await Promise.resolve();

    expect(api.advanceAiStep).not.toHaveBeenCalled();
  });

  test("schedules a retry when the backend throttle says AI work remains", async () => {
    const scene = createScene();
    const api = {
      advanceAiStep: vi.fn(async () => ({
        success: true,
        gameEnv: { aiPlayerIds: ["player_ai"] },
        aiAutoplay: { isAiMatch: true, hasMoreAiWork: false, throttleWaitMs: 0 },
      })),
    };
    const engine = {
      getSnapshot: vi
        .fn()
        .mockReturnValueOnce({
          raw: {
            aiAutoplay: { hasMoreAiWork: true, throttleWaitMs: 400 },
            gameEnv: { aiPlayerIds: ["player_ai"] },
          },
        })
        .mockReturnValue({
          raw: {
            aiAutoplay: { hasMoreAiWork: true, throttleWaitMs: 0 },
            gameEnv: { aiPlayerIds: ["player_ai"] },
          },
        }),
      updateGameStatus: vi.fn(async () => undefined),
    };
    const contextStore = {
      get: vi.fn(() => ({
        gameId: "game_1",
        playerId: "player_human",
        isAutoPolling: true,
        isAiMatch: true,
      })),
    };

    const controller = new AiStepController({
      scene: scene as any,
      api: api as any,
      engine: engine as any,
      contextStore: contextStore as any,
      isAnimationQueueRunning: () => false,
    });

    controller.handleAnimationQueueIdle();
    expect(scene.time.addEvent).toHaveBeenCalledTimes(1);
    const timerEvent = (scene.time.addEvent as any).mock.results[0].value;

    await timerEvent.callback();
    await Promise.resolve();
    await Promise.resolve();

    expect(api.advanceAiStep).toHaveBeenCalledTimes(1);
  });
});
