import { describe, expect, it, vi } from "vitest";
import { BurstChoiceFlowManager } from "../src/phaser/controllers/BurstChoiceFlowManager";
import { BurstChoiceGroupFlowManager } from "../src/phaser/controllers/BurstChoiceGroupFlowManager";
import { BlockerFlowManager } from "../src/phaser/controllers/BlockerFlowManager";

describe("choice submit failure recovery", () => {
  it("reopens burst choice dialog when confirmBurstChoice fails", async () => {
    const onLoadingStart = vi.fn();
    const onLoadingEnd = vi.fn();
    const api = {
      confirmBurstChoice: vi
        .fn()
        .mockRejectedValueOnce(new Error("forced failure"))
        .mockResolvedValueOnce({ success: true }),
    } as any;
    const engine = {
      updateGameStatus: vi.fn(),
    } as any;
    let shownConfig: any;
    const burstChoiceDialog = {
      hide: vi.fn(),
      isOpen: vi.fn().mockReturnValue(false),
      show: vi.fn((config: any) => {
        shownConfig = config;
      }),
    };
    const manager = new BurstChoiceFlowManager({
      api,
      engine,
      gameContext: { gameId: "g1", playerId: "p1" } as any,
      actionControls: null,
      burstChoiceDialog: burstChoiceDialog as any,
      refreshActions: vi.fn(),
      onLoadingStart,
      onLoadingEnd,
    });
    const note = {
      id: "note_1",
      type: "BURST_EFFECT_CHOICE",
      payload: {
        event: {
          id: "burst_1",
          type: "BURST_EFFECT_CHOICE",
          playerId: "p1",
          status: "DECLARED",
          data: {
            userDecisionMade: false,
            carduid: "c1",
            availableTargets: [{ carduid: "c1", cardId: "CARD_1" }],
          },
        },
      },
    };
    const raw = { gameEnv: { notificationQueue: [note] } };
    const handlePromise = manager.handleNotification(note as any, raw as any);

    await shownConfig.onTrigger();

    expect(api.confirmBurstChoice).toHaveBeenCalledWith({
      gameId: "g1",
      playerId: "p1",
      eventId: "burst_1",
      confirmed: true,
    });
    expect(burstChoiceDialog.hide).toHaveBeenCalledTimes(1);
    expect(burstChoiceDialog.show).toHaveBeenCalledTimes(2);
    expect(onLoadingStart).toHaveBeenCalledTimes(1);
    expect(onLoadingEnd).toHaveBeenCalledTimes(1);
    expect(manager.isActive()).toBe(true);

    await shownConfig.onTrigger();
    await handlePromise;

    expect(api.confirmBurstChoice).toHaveBeenCalledTimes(2);
  });

  it("reopens the single burst dialog when group confirm fails", async () => {
    const onLoadingStart = vi.fn();
    const onLoadingEnd = vi.fn();
    const api = {
      confirmBurstChoice: vi
        .fn()
        .mockRejectedValueOnce(new Error("forced failure"))
        .mockResolvedValueOnce({ success: true }),
    } as any;
    let shownConfig: any;
    const burstChoiceDialog = {
      hide: vi.fn(async () => undefined),
      show: vi.fn((config: any) => {
        shownConfig = config;
      }),
    } as any;
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
    const event = {
      id: "burst_event_1",
      playerId: "p1",
      data: {
        playerId: "p1",
        availableTargets: [{ carduid: "c1", cardId: "CARD_1" }],
      },
    };
    const raw = {};

    const choicePromise = (manager as any).showSingleBurstChoice(event, raw);
    await shownConfig.onTrigger();

    expect(burstChoiceDialog.hide).toHaveBeenCalledTimes(1);
    expect(burstChoiceDialog.show).toHaveBeenCalledTimes(2);
    expect(onLoadingStart).toHaveBeenCalledTimes(1);
    expect(onLoadingEnd).toHaveBeenCalledTimes(1);

    await shownConfig.onTrigger();
    await choicePromise;

    expect(api.confirmBurstChoice).toHaveBeenCalledTimes(2);
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
