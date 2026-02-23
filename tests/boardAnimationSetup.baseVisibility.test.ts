import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCreateAnimationPipeline = vi.hoisted(() => vi.fn());

vi.mock("../src/phaser/controllers/AnimationPipeline", () => ({
  createAnimationPipeline: mockCreateAnimationPipeline,
}));

import { setupAnimationPipeline } from "../src/phaser/scene/boardAnimationSetup";

describe("setupAnimationPipeline base visibility refresh", () => {
  let onEventEnd: ((event: any, ctx: any) => void) | undefined;
  let queue: any;
  let slotAnimationRender: any;
  let baseShieldAnimationRender: any;

  const makeParams = () => {
    const renderSlots = vi.fn();
    const renderBaseAndShield = vi.fn();
    const renderGameEnv = vi.fn();
    const updateHandArea = vi.fn();
    const shouldRefreshHandForEvent = vi.fn(() => false);
    const slotPresenterToSlots = vi.fn(() => [{ slotId: "slot1", owner: "player" }]);

    return {
      params: {
        scene: {} as any,
        controls: { slotControls: {}, handControls: {} } as any,
        dialogs: {
          drawPopupDialog: {} as any,
          mulliganDialog: {} as any,
          chooseFirstPlayerDialog: {} as any,
          turnOrderStatusDialog: {} as any,
          waitingOpponentDialog: {} as any,
          mulliganWaitingDialog: {} as any,
          coinFlipOverlay: {} as any,
          phaseChangeDialog: {} as any,
        },
        api: { submitDeck: vi.fn(), startReady: vi.fn(), chooseFirstPlayer: vi.fn() } as any,
        engine: { updateGameStatus: vi.fn(), loadGameResources: vi.fn() } as any,
        dialogCoordinator: { updateFromSnapshot: vi.fn(), markMulliganDecisionSubmitted: vi.fn() } as any,
        gameContext: { gameId: "g1", playerId: "p1" },
        slotPresenter: { toSlots: slotPresenterToSlots } as any,
        resolveSlotOwnerByPlayer: vi.fn(),
        getTargetAnchorProviders: vi.fn(),
        startGame: vi.fn(),
        renderSlots,
        renderBaseAndShield,
        renderGameEnv,
        updateHandArea,
        shouldRefreshHandForEvent,
        handleAnimationQueueIdle: vi.fn(),
      } as any,
      spies: {
        renderSlots,
        renderBaseAndShield,
        renderGameEnv,
        updateHandArea,
        shouldRefreshHandForEvent,
        slotPresenterToSlots,
      },
    };
  };

  beforeEach(() => {
    onEventEnd = undefined;
    queue = {
      setOnIdle: vi.fn(),
      setOnEventStart: vi.fn(),
      setOnEventEnd: vi.fn((cb: (event: any, ctx: any) => void) => {
        onEventEnd = cb;
      }),
    };
    slotAnimationRender = {
      handleEventStart: vi.fn(),
      handleEventEnd: vi.fn(() => undefined),
    };
    baseShieldAnimationRender = {
      handleEventStart: vi.fn(),
      handleEventEnd: vi.fn(),
    };
    mockCreateAnimationPipeline.mockReset();
    mockCreateAnimationPipeline.mockReturnValue({
      animationQueue: queue,
      slotAnimationRender,
      baseShieldAnimationRender,
    });
  });

  it("refreshes base/shield when CARD_PLAYED_COMPLETED playAs=base", () => {
    const { params, spies } = makeParams();
    setupAnimationPipeline(params);

    const ctx = { currentRaw: { marker: "current" }, previousRaw: { marker: "previous" } };
    onEventEnd?.({ type: "CARD_PLAYED_COMPLETED", payload: { playAs: "base" } }, ctx);

    expect(baseShieldAnimationRender.handleEventEnd).toHaveBeenCalledOnce();
    expect(spies.renderBaseAndShield).toHaveBeenCalledWith(ctx.currentRaw);
    expect(spies.updateHandArea).not.toHaveBeenCalled();
  });

  it("does not refresh base/shield for non-base CARD_PLAYED_COMPLETED", () => {
    const { params, spies } = makeParams();
    setupAnimationPipeline(params);

    onEventEnd?.({ type: "CARD_PLAYED_COMPLETED", payload: { playAs: "slot" } }, { currentRaw: {} });

    expect(baseShieldAnimationRender.handleEventEnd).toHaveBeenCalledOnce();
    expect(spies.renderBaseAndShield).not.toHaveBeenCalled();
  });

  it("keeps GAME_ENV_REFRESH behavior unchanged", () => {
    const { params, spies } = makeParams();
    setupAnimationPipeline(params);

    const ctx = { currentRaw: { marker: "next" }, previousRaw: { marker: "prev" } };
    onEventEnd?.({ type: "GAME_ENV_REFRESH", payload: {} }, ctx);

    expect(baseShieldAnimationRender.handleEventEnd).toHaveBeenCalledOnce();
    expect(spies.slotPresenterToSlots).toHaveBeenCalledWith(ctx.currentRaw, "p1");
    expect(spies.renderSlots).toHaveBeenCalledWith([{ slotId: "slot1", owner: "player" }]);
    expect(spies.renderBaseAndShield).toHaveBeenCalledWith(ctx.currentRaw);
    expect(spies.updateHandArea).toHaveBeenCalledWith({ skipAnimation: true });
    expect(spies.renderGameEnv).toHaveBeenCalledWith(ctx.currentRaw);
  });
});
