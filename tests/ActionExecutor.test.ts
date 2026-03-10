import { describe, expect, it, vi } from "vitest";
import { AttackTargetCoordinator } from "../src/phaser/controllers/AttackTargetCoordinator";
import { ActionExecutor } from "../src/phaser/controllers/ActionExecutor";
import { SlotInteractionGate } from "../src/phaser/controllers/SlotInteractionGate";

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
    onLoadingStart: vi.fn(),
    onLoadingEnd: vi.fn(),
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

  it("fires loading hooks around successful player action", async () => {
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

    expect(deps.onLoadingStart).toHaveBeenCalledTimes(1);
    expect(deps.onLoadingEnd).toHaveBeenCalledTimes(1);
    expect(deps.onLoadingStart.mock.invocationCallOrder[0]).toBeLessThan(deps.onLoadingEnd.mock.invocationCallOrder[0]);
  });

  it("unwinds loading hooks when player action fails", async () => {
    const { deps, executor } = createExecutor({
      api: {
        playerAction: vi.fn(async () => {
          throw new Error("forced failure");
        }),
      },
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

    expect(deps.reportError).toHaveBeenCalledTimes(1);
    expect(deps.onLoadingStart).toHaveBeenCalledTimes(1);
    expect(deps.onLoadingEnd).toHaveBeenCalledTimes(1);
  });

  it("enters target selection without loading on initial attack-unit click", async () => {
    const actionControls = {
      setState: vi.fn(),
      setTransientLoading: vi.fn(),
    };
    const slotControls = {
      setSlotClickEnabled: vi.fn(),
    };
    const attackCoordinator = new AttackTargetCoordinator(actionControls as any, new SlotInteractionGate(slotControls as any));
    const { deps, executor } = createExecutor({
      attackCoordinator,
      getSelectedSlot: vi.fn(() => ({
        owner: "player",
        slotId: "slot1",
        unit: { cardUid: "attacker_1", isRested: false },
      })),
      getOpponentUnitSlots: vi.fn(() => [
        { owner: "opponent", slotId: "slot4", unit: { cardUid: "target_1", isRested: true } },
      ]),
    });

    await executor.handleAttackUnit();

    expect(deps.api.playerAction).not.toHaveBeenCalled();
    expect(actionControls.setTransientLoading).not.toHaveBeenCalled();
    expect(actionControls.setState).toHaveBeenCalledTimes(1);
  });

  it("submits attack-unit only once after target selection and clears loading after refresh", async () => {
    let releaseAction: (() => void) | undefined;
    const actionControls = {
      setState: vi.fn(),
      setTransientLoading: vi.fn(),
    };
    const slotControls = {
      setSlotClickEnabled: vi.fn(),
    };
    const attackCoordinator = new AttackTargetCoordinator(actionControls as any, new SlotInteractionGate(slotControls as any));
    const { deps, executor } = createExecutor({
      attackCoordinator,
      api: {
        playerAction: vi.fn(
          () =>
            new Promise((resolve) => {
              releaseAction = () => resolve({ success: true });
            }),
        ),
      },
      getSelectedSlot: vi.fn(() => ({
        owner: "player",
        slotId: "slot1",
        unit: { cardUid: "attacker_1", isRested: false },
      })),
      getOpponentUnitSlots: vi.fn(() => [
        { owner: "opponent", slotId: "slot4", unit: { cardUid: "target_1", isRested: true } },
      ]),
    });

    await executor.handleAttackUnit();
    const target = { owner: "opponent", slotId: "slot4", unit: { cardUid: "target_1" } } as any;

    const firstClick = attackCoordinator.handleSlot(target);
    const secondClick = attackCoordinator.handleSlot(target);

    expect(deps.api.playerAction).toHaveBeenCalledTimes(1);
    expect(await secondClick).toBe(false);
    expect(actionControls.setTransientLoading).toHaveBeenCalledWith(true);
    expect(slotControls.setSlotClickEnabled).toHaveBeenCalledWith(false);

    releaseAction?.();
    expect(await firstClick).toBe(true);

    expect(deps.engine.updateGameStatus).toHaveBeenCalledTimes(1);
    expect(actionControls.setTransientLoading).toHaveBeenLastCalledWith(false);
    expect(slotControls.setSlotClickEnabled).toHaveBeenLastCalledWith(true);
  });

  it("clears target-submit loading and slot lock when attack-unit submit fails", async () => {
    const actionControls = {
      setState: vi.fn(),
      setTransientLoading: vi.fn(),
    };
    const slotControls = {
      setSlotClickEnabled: vi.fn(),
    };
    const attackCoordinator = new AttackTargetCoordinator(actionControls as any, new SlotInteractionGate(slotControls as any));
    const { deps, executor } = createExecutor({
      attackCoordinator,
      api: {
        playerAction: vi.fn(async () => {
          throw new Error("forced failure");
        }),
      },
      getSelectedSlot: vi.fn(() => ({
        owner: "player",
        slotId: "slot1",
        unit: { cardUid: "attacker_1", isRested: false },
      })),
      getOpponentUnitSlots: vi.fn(() => [
        { owner: "opponent", slotId: "slot4", unit: { cardUid: "target_1", isRested: true } },
      ]),
    });

    await executor.handleAttackUnit();
    const target = { owner: "opponent", slotId: "slot4", unit: { cardUid: "target_1" } } as any;

    expect(await attackCoordinator.handleSlot(target)).toBe(true);

    expect(deps.reportError).toHaveBeenCalledTimes(1);
    expect(actionControls.setTransientLoading).toHaveBeenCalledWith(true);
    expect(actionControls.setTransientLoading).toHaveBeenLastCalledWith(false);
    expect(slotControls.setSlotClickEnabled).toHaveBeenCalledWith(false);
    expect(slotControls.setSlotClickEnabled).toHaveBeenLastCalledWith(true);
  });
});
