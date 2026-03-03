import { describe, expect, it, vi } from "vitest";
import { SelectionHandler } from "../src/phaser/controllers/SelectionHandler";

function createSelectionHandler(overrides: Partial<any> = {}) {
  const raw = {
    gameEnv: {
      currentPlayer: "player_1",
      players: {
        player_1: {
          deck: {
            hand: [
              {
                carduid: "hand_1",
                cardData: { cardType: "unit" },
              },
            ],
          },
        },
      },
    },
  };

  const deps = {
    engine: {
      getSnapshot: vi.fn(() => ({ raw })),
      select: vi.fn(),
      clearSelection: vi.fn(),
    },
    handControls: {
      setHand: vi.fn(),
      clearSelection: vi.fn(),
    },
    slotControls: {
      setSelectedSlot: vi.fn(),
      setSlotPreviewEnabled: vi.fn(),
      hidePreviewNow: vi.fn(),
    },
    baseControls: {
      setSelectedBase: vi.fn(),
    },
    gameContext: {
      playerId: "player_1",
    },
    blockerFlow: {
      handleSnapshot: vi.fn(),
      isActive: vi.fn(() => false),
    },
    attackCoordinator: {
      handleSlot: vi.fn(async () => false),
      isActive: vi.fn(() => false),
      isAllowed: vi.fn(() => true),
      reset: vi.fn(),
    },
    actionStepCoordinator: {
      getStatus: vi.fn(() => "none"),
      isInActionStep: vi.fn(() => false),
      isHandCardTarget: vi.fn(() => true),
      cardDataHasActionStepWindow: vi.fn(() => true),
      isSlotTarget: vi.fn(() => true),
      slotHasActionStepWindow: vi.fn(() => true),
    },
    refreshActions: vi.fn(),
    showOverlay: vi.fn(),
    ...overrides,
  };

  return {
    deps,
    handler: new SelectionHandler(deps as any),
  };
}

describe("SelectionHandler", () => {
  it("selects player base and highlights it", () => {
    const { deps, handler } = createSelectionHandler();

    handler.handleBaseCardSelected({
      side: "player",
      card: { cardId: "base_1", cardData: {} },
    });

    expect(deps.baseControls.setSelectedBase).toHaveBeenLastCalledWith("player");
    expect(deps.engine.select).toHaveBeenCalledWith({
      kind: "base",
      side: "player",
      cardId: "base_1",
    });
    expect(deps.refreshActions).toHaveBeenCalledWith("base");
  });

  it("clears base highlight when selecting a hand card", () => {
    const { deps, handler } = createSelectionHandler();
    handler.handleBaseCardSelected({
      side: "player",
      card: { cardId: "base_1", cardData: {} },
    });

    handler.handleHandCardSelected({
      uid: "hand_1",
      cardType: "unit",
      cardId: "GD01-001",
    } as any);

    expect(deps.baseControls.setSelectedBase).toHaveBeenLastCalledWith();
    expect(deps.engine.select).toHaveBeenLastCalledWith({
      kind: "hand",
      uid: "hand_1",
      cardType: "unit",
      fromPilotDesignation: undefined,
      cardId: "GD01-001",
    });
    expect(deps.refreshActions).toHaveBeenLastCalledWith("hand");
  });

  it("clears base highlight when selecting a slot", async () => {
    const { deps, handler } = createSelectionHandler();
    handler.handleBaseCardSelected({
      side: "player",
      card: { cardId: "base_1", cardData: {} },
    });

    await handler.handleSlotCardSelected({
      owner: "player",
      slotId: "slot1",
      unit: {
        id: "GD01-001",
        cardUid: "unit_1",
        cardType: "unit",
        canAttackThisTurn: true,
        isRested: false,
        textureKey: "unit_1-preview",
      },
      pilot: undefined,
      isRested: false,
      ap: 1,
      hp: 1,
    } as any);

    expect(deps.baseControls.setSelectedBase).toHaveBeenLastCalledWith();
    expect(deps.engine.select).toHaveBeenLastCalledWith({
      kind: "slot",
      slotId: "slot1",
      owner: "player",
    });
    expect(deps.refreshActions).toHaveBeenLastCalledWith("slot");
  });

  it("clearSelectionUI clears base highlight", () => {
    const { deps, handler } = createSelectionHandler();

    handler.clearSelectionUI({ clearEngine: true });

    expect(deps.baseControls.setSelectedBase).toHaveBeenCalledWith();
    expect(deps.engine.clearSelection).toHaveBeenCalledTimes(1);
  });

  it("resets attack coordinator when selecting player base during attack targeting", () => {
    const { deps, handler } = createSelectionHandler({
      attackCoordinator: {
        handleSlot: vi.fn(async () => false),
        isActive: vi.fn(() => true),
        isAllowed: vi.fn(() => true),
        reset: vi.fn(),
      },
    });

    handler.handleBaseCardSelected({
      side: "player",
      card: { cardId: "base_1", cardData: {} },
    });

    expect(deps.attackCoordinator.reset).toHaveBeenCalledTimes(1);
    expect(deps.baseControls.setSelectedBase).toHaveBeenLastCalledWith("player");
    expect(deps.refreshActions).toHaveBeenCalledWith("base");
  });
});
