import { describe, expect, it, vi } from "vitest";
import { PilotFlowController } from "../src/phaser/controllers/PilotFlowController";

describe("PilotFlowController", () => {
  it("sets pilot target and runs playPilotDesignationAsPilot after target selection", async () => {
    let shownConfig: any;
    const engine = {
      getSnapshot: vi.fn(() => ({
        raw: {
          gameEnv: {
            phase: "MAIN",
            players: {
              player_1: {
                zones: {
                  slot1: { unit: { carduid: "unit_1", cardData: {} } },
                },
              },
            },
          },
        },
      })),
      setPilotTarget: vi.fn(),
    } as any;
    const runActionThenRefresh = vi.fn(async () => undefined);
    const controller = new PilotFlowController({
      scene: {} as any,
      engine,
      slotPresenter: {
        toSlots: vi.fn(() => [{ owner: "player", slotId: "slot1", unit: { cardUid: "unit_1" } }]),
      } as any,
      gameContext: { playerId: "player_1" } as any,
      pilotTargetDialog: {
        show: vi.fn((config: any) => {
          shownConfig = config;
        }),
      } as any,
      pilotDesignationDialog: {} as any,
      runActionThenRefresh,
    });

    controller.showPilotTargetDialog("playPilotDesignationAsPilot");
    await shownConfig.onSelect({ owner: "player", slotId: "slot1", unit: { cardUid: "unit_1" } });

    expect(engine.setPilotTarget).toHaveBeenNthCalledWith(1, undefined);
    expect(engine.setPilotTarget).toHaveBeenNthCalledWith(2, "unit_1");
    expect(runActionThenRefresh).toHaveBeenCalledWith("playPilotDesignationAsPilot", "neutral");
  });
});
