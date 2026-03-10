import { describe, expect, it, vi } from "vitest";
import { UnitFlowController } from "../src/phaser/controllers/UnitFlowController";

describe("UnitFlowController", () => {
  it("opens the replace dialog before submitting when the board is full", async () => {
    const raw = {
      gameEnv: {
        players: {
          player_1: {
            zones: {
              slot1: { unit: { carduid: "slot1_unit", cardData: {} } },
              slot2: { unit: { carduid: "slot2_unit", cardData: {} } },
              slot3: { unit: { carduid: "slot3_unit", cardData: {} } },
              slot4: { unit: { carduid: "slot4_unit", cardData: {} } },
              slot5: { unit: { carduid: "slot5_unit", cardData: {} } },
              slot6: { unit: { carduid: "slot6_unit", cardData: {} } },
              energyArea: [],
            },
            deck: {
              hand: [{ carduid: "unit_1", cardData: { effects: { rules: [] } } }],
            },
          },
        },
      },
    };
    const pilotTargetDialog = { show: vi.fn() };
    const slotPresenter = {
      toSlots: vi.fn(() =>
        ["slot1", "slot2", "slot3", "slot4", "slot5", "slot6"].map((slotId) => ({
          owner: "player",
          slotId,
          unit: { cardUid: `${slotId}_unit`, cardData: {} },
        })),
      ),
    };
    const controller = new UnitFlowController({
      engine: { getSnapshot: vi.fn(() => ({ raw })) } as any,
      gameContext: { playerId: "player_1" } as any,
      slotPresenter: slotPresenter as any,
      pilotTargetDialog: pilotTargetDialog as any,
      errorDialog: null,
    });
    const runPlayCard = vi.fn(async () => ({ success: true }));

    const result = await controller.handlePlayUnit({
      selection: { kind: "hand", uid: "unit_1", cardType: "unit" },
      gameId: "game_1",
      playerId: "player_1",
      runPlayCard,
      refreshStatus: vi.fn(),
      clearSelection: vi.fn(),
    } as any);

    expect(result).toBe(false);
    expect(runPlayCard).not.toHaveBeenCalled();
    expect(pilotTargetDialog.show).toHaveBeenCalledTimes(1);
  });
});
