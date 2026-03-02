import { describe, expect, it, vi } from "vitest";
import { BurstChoiceFlowManager } from "../src/phaser/controllers/BurstChoiceFlowManager";

describe("BurstChoiceFlowManager opponent visibility", () => {
  it("shows burst card dialog for non-owner without action buttons", async () => {
    const dialog = {
      hide: vi.fn(),
      isOpen: vi.fn().mockReturnValue(false),
      show: vi.fn(),
    } as any;

    const manager = new BurstChoiceFlowManager({
      api: { confirmBurstChoice: vi.fn() } as any,
      engine: { updateGameStatus: vi.fn() } as any,
      gameContext: { gameId: "g1", playerId: "playerId_2" } as any,
      actionControls: {
        setWaitingForOpponent: vi.fn(),
        setState: vi.fn(),
      } as any,
      burstChoiceDialog: dialog,
      refreshActions: vi.fn(),
    });

    const notification = {
      id: "burst_note_1",
      type: "BURST_EFFECT_CHOICE",
      payload: {
        playerId: "playerId_1",
        event: {
          id: "burst_event_1",
          type: "BURST_EFFECT_CHOICE",
          playerId: "playerId_1",
          status: "DECLARED",
          data: {
            userDecisionMade: false,
            carduid: "GD02-103_shield_p1_0001",
            availableTargets: [
              {
                carduid: "GD02-103_shield_p1_0001",
                cardId: "GD02-103",
                cardData: {
                  id: "GD02-103",
                  name: "AGE Device",
                  cardType: "command",
                },
              },
            ],
          },
        },
      },
    };

    await manager.handleNotification(notification as any, {
      gameEnv: { players: {} },
    });

    expect(dialog.show).toHaveBeenCalledTimes(1);
    const args = dialog.show.mock.calls[0][0];
    expect(args?.showButtons).toBe(false);
    expect(args?.showTimer).toBe(false);
    expect(args?.card?.cardId).toBe("GD02-103");
  });
});
