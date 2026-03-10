import { describe, expect, test, vi } from "vitest";
import { EffectTargetController } from "../src/phaser/controllers/EffectTargetController";

describe("EffectTargetController", () => {
  test("reopens manual target dialog after a failed submit result", async () => {
    let shownConfig: any;
    const dialog = {
      show: vi.fn((config: any) => {
        shownConfig = config;
      }),
      hide: vi.fn(async () => undefined),
    };
    const onPlayerAction = vi.fn();
    const submit = vi
      .fn<[(slot: any) => Promise<boolean>], any>()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const controller = new EffectTargetController({
      dialog: dialog as any,
      slotPresenter: {} as any,
      gameContext: { gameId: "game_1", playerId: "player_1" } as any,
      engine: {} as any,
      api: {} as any,
      scene: {} as any,
      onPlayerAction,
    });
    const slot = { owner: "player", slotId: "front_1", unit: { cardUid: "u1" } };

    await controller.showManualTargets({
      targets: [slot] as any,
      header: "Choose blocker",
      onSelect: async (selected) => submit(selected),
      showCloseButton: true,
    });

    await shownConfig.onSelect(slot);

    expect(submit).toHaveBeenCalledTimes(1);
    expect(dialog.hide).toHaveBeenCalledTimes(1);
    expect(dialog.show).toHaveBeenCalledTimes(2);
    expect(onPlayerAction).not.toHaveBeenCalled();

    await shownConfig.onSelect(slot);

    expect(submit).toHaveBeenCalledTimes(2);
    expect(dialog.hide).toHaveBeenCalledTimes(2);
    expect(dialog.show).toHaveBeenCalledTimes(2);
    expect(onPlayerAction).toHaveBeenCalledTimes(1);
  });
});
