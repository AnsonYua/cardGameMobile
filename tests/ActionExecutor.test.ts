import { describe, expect, it, vi } from "vitest";
import { ActionExecutor } from "../src/phaser/controllers/ActionExecutor";

function createExecutor(overrides: Partial<any> = {}) {
  const deps = {
    api: {
      playerAction: vi.fn(async () => ({ success: true })),
    },
    engine: {
      getSnapshot: vi.fn(() => ({ raw: {} })),
      updateGameStatus: vi.fn(async () => undefined),
    },
    gameContext: {
      gameId: "game_latest",
      playerId: "player_latest",
    },
    attackCoordinator: {
      enter: vi.fn(),
      reset: vi.fn(),
    },
    getSelectedSlot: vi.fn(() => undefined),
    getOpponentRestedUnitSlots: vi.fn(() => []),
    getOpponentUnitSlots: vi.fn(() => []),
    getOpponentPlayerId: vi.fn(() => "player_2"),
    clearSelection: vi.fn(),
    refreshNeutral: vi.fn(),
    reportError: vi.fn(),
    ...overrides,
  };

  return {
    deps,
    executor: new ActionExecutor(deps as any),
  };
}

describe("ActionExecutor", () => {
  it("sanitizes playerAction payload with latest gameId/playerId", async () => {
    const { deps, executor } = createExecutor();

    await (executor as any).runPlayerAction(
      {
        playerId: "stale_player",
        gameId: "stale_game",
        actionType: "confirmBattle",
      },
      { cancelOnSuccess: false, cancelOnError: false },
    );

    expect(deps.api.playerAction).toHaveBeenCalledTimes(1);
    expect(deps.api.playerAction).toHaveBeenCalledWith({
      playerId: "player_latest",
      gameId: "game_latest",
      actionType: "confirmBattle",
    });
    expect(deps.engine.updateGameStatus).toHaveBeenCalledWith("game_latest", "player_latest");
  });

  it("skips confirmBattle when battle is not in ACTION_STEP", async () => {
    const { deps, executor } = createExecutor({
      engine: {
        getSnapshot: vi.fn(() => ({
          raw: {
            gameEnv: {
              currentBattle: { status: "RESOLVING" },
            },
          },
        })),
        updateGameStatus: vi.fn(async () => undefined),
      },
    });

    await executor.handleSkipAction();

    expect(deps.api.playerAction).not.toHaveBeenCalled();
    expect(deps.refreshNeutral).toHaveBeenCalledTimes(1);
  });

  it("sends confirmBattle when battle is in ACTION_STEP", async () => {
    const { deps, executor } = createExecutor({
      engine: {
        getSnapshot: vi.fn(() => ({
          raw: {
            gameEnv: {
              currentBattle: { status: "ACTION_STEP" },
            },
          },
        })),
        updateGameStatus: vi.fn(async () => undefined),
      },
    });

    await executor.handleSkipAction();

    expect(deps.api.playerAction).toHaveBeenCalledTimes(1);
    expect(deps.api.playerAction).toHaveBeenCalledWith({
      playerId: "player_latest",
      gameId: "game_latest",
      actionType: "confirmBattle",
    });
  });
});
