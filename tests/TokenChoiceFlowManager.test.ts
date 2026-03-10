import { describe, expect, test, vi } from "vitest";
import { TokenChoiceFlowManager } from "../src/phaser/controllers/TokenChoiceFlowManager";

describe("TokenChoiceFlowManager", () => {
  test("reopens the token dialog on submit failure and allows retry", async () => {
    const confirmTokenChoice = vi
      .fn()
      .mockRejectedValueOnce(new Error("forced failure"))
      .mockResolvedValueOnce({ success: true });
    const updateGameStatus = vi.fn(async () => undefined);
    const onReportError = vi.fn();
    let shownConfig: any;
    const tokenChoiceDialog = {
      isOpen: vi.fn(() => false),
      show: vi.fn((config: any) => {
        shownConfig = config;
      }),
      hide: vi.fn(),
    };

    const manager = new TokenChoiceFlowManager({
      api: { confirmTokenChoice } as any,
      engine: {
        updateGameStatus,
        getSnapshot: vi.fn(() => ({ raw: { gameEnv: { notificationQueue: [] } } })),
      } as any,
      gameContext: { gameId: "game_1", playerId: "player_1" } as any,
      refreshActions: vi.fn(),
      tokenChoiceDialog: tokenChoiceDialog as any,
      onReportError,
    });

    const note = {
      id: "token_choice_1",
      playerId: "player_1",
      isCompleted: false,
      decisionMade: false,
      data: {
        availableChoices: [{ index: 0, cardId: "token_card_1", enabled: true }],
      },
    };

    const raw = {
      gameEnv: {
        notificationQueue: [
          {
            id: "note_1",
            type: "TOKEN_CHOICE",
            payload: {
              id: "token_choice_1",
              playerId: "player_1",
              isCompleted: false,
              decisionMade: false,
              data: note.data,
            },
          },
        ],
      },
    };

    const handlePromise = manager.handleNotification(raw.gameEnv.notificationQueue[0] as any, raw as any);

    await shownConfig.onSelect(0);

    expect(confirmTokenChoice).toHaveBeenCalledTimes(1);
    expect(tokenChoiceDialog.hide).toHaveBeenCalledTimes(1);
    expect(tokenChoiceDialog.show).toHaveBeenCalledTimes(2);
    expect(onReportError).toHaveBeenCalledTimes(1);

    await shownConfig.onSelect(0);
    await handlePromise;

    expect(confirmTokenChoice).toHaveBeenCalledTimes(2);
    expect(updateGameStatus).toHaveBeenCalledTimes(1);
    expect(tokenChoiceDialog.hide).toHaveBeenCalledTimes(2);
    expect(tokenChoiceDialog.show).toHaveBeenCalledTimes(2);
  });
});
