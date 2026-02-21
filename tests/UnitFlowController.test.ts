import { describe, expect, it, vi } from "vitest";
import { UnitFlowController } from "../src/phaser/controllers/UnitFlowController";

function createBaseContext() {
  return {
    selection: { kind: "hand", uid: "ST01-001_uid", cardType: "unit" },
    gameId: "game_1",
    playerId: "player_1",
    runPlayCard: vi.fn(async () => ({ success: true })),
    refreshStatus: vi.fn(async () => undefined),
    clearSelection: vi.fn(),
  };
}

describe("UnitFlowController", () => {
  it("plays unit immediately when board is not full", async () => {
    const ctx = createBaseContext();
    const controller = new UnitFlowController();

    const result = await controller.handlePlayUnit(ctx as any);

    expect(result).toBe(true);
    expect(ctx.runPlayCard).toHaveBeenCalledTimes(1);
    expect(ctx.runPlayCard).toHaveBeenCalledWith({
      playerId: "player_1",
      gameId: "game_1",
      action: { type: "PlayCard", carduid: "ST01-001_uid", playAs: "unit" },
    });
    expect(ctx.refreshStatus).toHaveBeenCalledTimes(1);
    expect(ctx.clearSelection).toHaveBeenCalledTimes(1);
  });

  it("opens replace-slot dialog when backend reports full board", async () => {
    const ctx = createBaseContext();
    ctx.runPlayCard = vi.fn(async () => {
      throw new Error("Board is full. Choose a slot to replace.");
    });

    const pilotTargetDialog = { show: vi.fn() };
    const controller = new UnitFlowController({
      engine: { getSnapshot: vi.fn(() => ({ raw: { gameEnv: {} } })) } as any,
      gameContext: { playerId: "player_1" } as any,
      slotPresenter: {
        toSlots: vi.fn(() => [{ owner: "player", slotId: "slot2", unit: { cardUid: "U2" } }]),
      } as any,
      pilotTargetDialog: pilotTargetDialog as any,
      errorDialog: { show: vi.fn() } as any,
    });

    const result = await controller.handlePlayUnit(ctx as any);

    expect(result).toBe(false);
    expect(pilotTargetDialog.show).toHaveBeenCalledTimes(1);
    const opts = pilotTargetDialog.show.mock.calls[0][0];
    expect(opts.header).toBe("Board is full - Choose a slot to trash");
    expect(opts.targets).toHaveLength(1);
  });

  it("retries play with replaceSlot after slot selection", async () => {
    const ctx = createBaseContext();
    ctx.runPlayCard = vi
      .fn()
      .mockRejectedValueOnce(new Error("Board is full. Choose a slot to replace."))
      .mockResolvedValueOnce({ success: true });

    let dialogOpts: any;
    const pilotTargetDialog = {
      show: vi.fn((opts: any) => {
        dialogOpts = opts;
      }),
    };

    const controller = new UnitFlowController({
      engine: { getSnapshot: vi.fn(() => ({ raw: { gameEnv: {} } })) } as any,
      gameContext: { playerId: "player_1" } as any,
      slotPresenter: {
        toSlots: vi.fn(() => [{ owner: "player", slotId: "slot4", unit: { cardUid: "U4" } }]),
      } as any,
      pilotTargetDialog: pilotTargetDialog as any,
      errorDialog: { show: vi.fn() } as any,
    });

    const firstResult = await controller.handlePlayUnit(ctx as any);
    expect(firstResult).toBe(false);
    expect(typeof dialogOpts?.onSelect).toBe("function");

    await dialogOpts.onSelect({ owner: "player", slotId: "slot4", unit: { cardUid: "U4" } });

    expect(ctx.runPlayCard).toHaveBeenCalledTimes(2);
    expect(ctx.runPlayCard).toHaveBeenNthCalledWith(2, {
      playerId: "player_1",
      gameId: "game_1",
      action: { type: "PlayCard", carduid: "ST01-001_uid", playAs: "unit", replaceSlot: "slot4" },
    });
    expect(ctx.refreshStatus).toHaveBeenCalledTimes(1);
    expect(ctx.clearSelection).toHaveBeenCalledTimes(1);
  });
});
