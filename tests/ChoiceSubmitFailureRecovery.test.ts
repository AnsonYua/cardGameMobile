import { describe, expect, it, vi } from "vitest";
import { BurstChoiceFlowManager } from "../src/phaser/controllers/BurstChoiceFlowManager";
import { BurstChoiceGroupFlowManager } from "../src/phaser/controllers/BurstChoiceGroupFlowManager";
import { BlockerFlowManager } from "../src/phaser/controllers/BlockerFlowManager";

describe("choice submit failure recovery", () => {
  it("keeps burst choice flow active when confirmBurstChoice fails", async () => {
    const onLoadingStart = vi.fn();
    const onLoadingEnd = vi.fn();
    const api = {
      confirmBurstChoice: vi.fn().mockRejectedValue(new Error("forced failure")),
    } as any;
    const engine = {
      updateGameStatus: vi.fn(),
    } as any;
    const manager = new BurstChoiceFlowManager({
      api,
      engine,
      gameContext: { gameId: "g1", playerId: "p1" } as any,
      actionControls: null,
      burstChoiceDialog: { hide: vi.fn(), isOpen: vi.fn().mockReturnValue(false) } as any,
      refreshActions: vi.fn(),
      onLoadingStart,
      onLoadingEnd,
    });

    (manager as any).queueEntry = {
      id: "burst_1",
      eventId: "burst_1",
      playerId: "p1",
      data: { userDecisionMade: false },
    };

    await (manager as any).submitChoice("ACTIVATE");

    expect(api.confirmBurstChoice).toHaveBeenCalledWith({
      gameId: "g1",
      playerId: "p1",
      eventId: "burst_1",
      confirmed: true,
    });
    expect(onLoadingStart).toHaveBeenCalledTimes(1);
    expect(onLoadingEnd).toHaveBeenCalledTimes(1);
    expect(manager.isActive()).toBe(true);
  });

  it("returns false and keeps dialog dismissed when group burst confirm fails", async () => {
    const onLoadingStart = vi.fn();
    const onLoadingEnd = vi.fn();
    const api = {
      confirmBurstChoice: vi.fn().mockRejectedValue(new Error("forced failure")),
    } as any;
    const burstChoiceDialog = { hide: vi.fn() } as any;
    const manager = new BurstChoiceGroupFlowManager({
      api,
      engine: { updateGameStatus: vi.fn() } as any,
      gameContext: { gameId: "g1", playerId: "p1" } as any,
      actionControls: null,
      groupDialog: { hide: vi.fn(), isOpen: vi.fn().mockReturnValue(true), show: vi.fn() } as any,
      burstChoiceDialog,
      refreshActions: vi.fn(),
      onLoadingStart,
      onLoadingEnd,
    });

    const ok = await (manager as any).submitChoice("burst_event_1", true);

    expect(ok).toBe(false);
    expect(burstChoiceDialog.hide).toHaveBeenCalledTimes(1);
    expect(onLoadingStart).toHaveBeenCalledTimes(1);
    expect(onLoadingEnd).toHaveBeenCalledTimes(1);
  });

  it("does not clear blocker flow state when confirmBlockerChoice fails", async () => {
    const onLoadingStart = vi.fn();
    const onLoadingEnd = vi.fn();
    const api = {
      confirmBlockerChoice: vi.fn().mockRejectedValue(new Error("forced failure")),
    } as any;
    const manager = new BlockerFlowManager({
      api,
      engine: { updateGameStatus: vi.fn() } as any,
      gameContext: { gameId: "g1", playerId: "p1" } as any,
      slotPresenter: {} as any,
      actionControls: null,
      effectTargetController: null,
      refreshActions: vi.fn(),
      slotGate: { disable: vi.fn(), enable: vi.fn() } as any,
      onPlayerAction: vi.fn(),
      onLoadingStart,
      onLoadingEnd,
    });

    (manager as any).queueEntry = { id: "blocker_1", playerId: "p1", data: {} };
    (manager as any).notificationId = "note_blocker_1";

    await (manager as any).postBlockChoice([]);

    expect(api.confirmBlockerChoice).toHaveBeenCalledWith({
      gameId: "g1",
      playerId: "p1",
      eventId: "blocker_1",
      notificationId: "note_blocker_1",
      selectedTargets: [],
    });
    expect(onLoadingStart).toHaveBeenCalledTimes(1);
    expect(onLoadingEnd).toHaveBeenCalledTimes(1);
    expect(manager.isActive()).toBe(true);
  });
});
