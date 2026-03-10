import { describe, expect, test, vi } from "vitest";
import { OptionChoiceFlowManager } from "./OptionChoiceFlowManager";

describe("OptionChoiceFlowManager", () => {
  test("renders ATTACK_EFFECT_ORDER option choice and submits selected option index", async () => {
    const confirmOptionChoice = vi.fn(async () => ({ success: true }));
    const updateGameStatus = vi.fn(async () => undefined);
    const refreshActions = vi.fn();

    let shownConfig: any;
    const dialog = {
      isOpen: vi.fn(() => false),
      show: vi.fn((config: any) => {
        shownConfig = config;
      }),
      hide: vi.fn(),
    };

    const manager = new OptionChoiceFlowManager({
      api: { confirmOptionChoice } as any,
      engine: { updateGameStatus } as any,
      gameContext: { gameId: "game_1", playerId: "playerId_1" } as any,
      refreshActions,
      optionChoiceDialog: dialog as any,
      actionControls: {
        setWaitingLabel: vi.fn(),
        setWaitingForOpponent: vi.fn(),
        setState: vi.fn(),
      } as any,
    });

    const note = {
      id: "option_choice_attack_1",
      type: "OPTION_CHOICE",
      payload: {
        event: {
          id: "option_choice_attack_1",
          type: "OPTION_CHOICE",
          playerId: "playerId_1",
          status: "DECLARED",
          data: {
            userDecisionMade: false,
            sourceCarduid: "GD02-057_unit_0001",
            effect: {
              effectId: "attack_effect_order",
              type: "internal",
              trigger: "CHOICE",
              action: "attack_effect_order",
            },
            headerText: "Choose Effect Order",
            promptText: "Select which attack effect resolves first.",
            availableOptions: [
              { index: 0, label: "Zedas: attack_effect (damage)" },
              { index: 1, label: "Kira Yamato: attack_reduce_enemy_ap (modifyAP)" },
            ],
            context: {
              kind: "ATTACK_EFFECT_ORDER",
            },
          },
        },
      },
    };

    const raw = {
      gameEnv: {
        notificationQueue: [note],
      },
    };

    const handlePromise = manager.handleNotification(note as any, raw as any);
    expect(dialog.show).toHaveBeenCalledTimes(1);
    expect(shownConfig.headerText).toBe("Choose Effect Order");
    expect(shownConfig.promptText).toBe("Select which attack effect resolves first.");
    expect(shownConfig.choices).toHaveLength(2);

    await shownConfig.onSelect(1);
    await handlePromise;

    expect(confirmOptionChoice).toHaveBeenCalledWith({
      gameId: "game_1",
      playerId: "playerId_1",
      eventId: "option_choice_attack_1",
      selectedOptionIndex: 1,
    });
    expect(updateGameStatus).toHaveBeenCalledWith("game_1", "playerId_1");
  });

  test("hides dialog and wraps submit with loading callbacks", async () => {
    const confirmOptionChoice = vi.fn(async () => ({ success: true }));
    const updateGameStatus = vi.fn(async () => undefined);
    const onLoadingStart = vi.fn();
    const onLoadingEnd = vi.fn();
    let shownConfig: any;
    const dialog = {
      isOpen: vi.fn(() => false),
      show: vi.fn((config: any) => {
        shownConfig = config;
      }),
      hide: vi.fn(),
    };

    const manager = new OptionChoiceFlowManager({
      api: { confirmOptionChoice } as any,
      engine: { updateGameStatus } as any,
      gameContext: { gameId: "game_1", playerId: "playerId_1" } as any,
      refreshActions: vi.fn(),
      optionChoiceDialog: dialog as any,
      onLoadingStart,
      onLoadingEnd,
    });

    const note = {
      id: "option_choice_attack_1",
      type: "OPTION_CHOICE",
      payload: {
        event: {
          id: "option_choice_attack_1",
          type: "OPTION_CHOICE",
          playerId: "playerId_1",
          status: "DECLARED",
          data: {
            userDecisionMade: false,
            availableOptions: [{ index: 0, label: "A" }],
          },
        },
      },
    };

    const raw = { gameEnv: { notificationQueue: [note] } };
    const handlePromise = manager.handleNotification(note as any, raw as any);
    await shownConfig.onSelect(0);
    await handlePromise;

    expect(dialog.hide).toHaveBeenCalledTimes(1);
    expect(onLoadingStart).toHaveBeenCalledTimes(1);
    expect(onLoadingEnd).toHaveBeenCalledTimes(1);
    expect(dialog.hide.mock.invocationCallOrder[0]).toBeLessThan(confirmOptionChoice.mock.invocationCallOrder[0]);
    expect(onLoadingStart.mock.invocationCallOrder[0]).toBeLessThan(confirmOptionChoice.mock.invocationCallOrder[0]);
    expect(onLoadingEnd.mock.invocationCallOrder[0]).toBeGreaterThan(confirmOptionChoice.mock.invocationCallOrder[0]);
  });

  test("reopens dialog on failure and allows submit retry", async () => {
    const confirmOptionChoice = vi
      .fn()
      .mockRejectedValueOnce(new Error("forced failure"))
      .mockResolvedValueOnce({ success: true });
    const updateGameStatus = vi.fn(async () => undefined);
    const onReportError = vi.fn();
    let shownConfig: any;
    const dialog = {
      isOpen: vi.fn(() => false),
      show: vi.fn((config: any) => {
        shownConfig = config;
      }),
      hide: vi.fn(),
    };

    const manager = new OptionChoiceFlowManager({
      api: { confirmOptionChoice } as any,
      engine: { updateGameStatus } as any,
      gameContext: { gameId: "game_1", playerId: "playerId_1" } as any,
      refreshActions: vi.fn(),
      optionChoiceDialog: dialog as any,
      onReportError,
    });

    const note = {
      id: "option_choice_attack_1",
      type: "OPTION_CHOICE",
      payload: {
        event: {
          id: "option_choice_attack_1",
          type: "OPTION_CHOICE",
          playerId: "playerId_1",
          status: "DECLARED",
          data: {
            userDecisionMade: false,
            availableOptions: [{ index: 0, label: "A" }],
          },
        },
      },
    };

    const raw = { gameEnv: { notificationQueue: [note] } };
    const handlePromise = manager.handleNotification(note as any, raw as any);
    await shownConfig.onSelect(0);
    expect(confirmOptionChoice).toHaveBeenCalledTimes(1);
    expect(dialog.show).toHaveBeenCalledTimes(2);
    expect(dialog.hide).toHaveBeenCalledTimes(1);
    expect(onReportError).toHaveBeenCalledTimes(1);

    await shownConfig.onSelect(0);
    await handlePromise;

    expect(confirmOptionChoice).toHaveBeenCalledTimes(2);
    expect(updateGameStatus).toHaveBeenCalledTimes(1);
    expect(dialog.hide).toHaveBeenCalledTimes(2);
    expect(dialog.show).toHaveBeenCalledTimes(2);
  });
});
