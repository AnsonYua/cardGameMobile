import { describe, expect, test, vi } from "vitest";
import { PromptChoiceFlowManager } from "../src/phaser/controllers/PromptChoiceFlowManager";

describe("PromptChoiceFlowManager", () => {
  test("reopens the prompt dialog on submit failure and allows retry", async () => {
    const confirmOptionChoice = vi
      .fn()
      .mockRejectedValueOnce(new Error("forced failure"))
      .mockResolvedValueOnce({ success: true });
    const updateGameStatus = vi.fn(async () => undefined);
    const onReportError = vi.fn();
    let shownConfig: any;
    const promptChoiceDialog = {
      isOpen: vi.fn(() => false),
      show: vi.fn((config: any) => {
        shownConfig = config;
      }),
      hide: vi.fn(),
    };

    const manager = new PromptChoiceFlowManager({
      api: { confirmOptionChoice } as any,
      engine: { updateGameStatus } as any,
      gameContext: { gameId: "game_1", playerId: "player_1" } as any,
      refreshActions: vi.fn(),
      promptChoiceDialog: promptChoiceDialog as any,
      topDeckSelectionReviewDialog: null,
      onReportError,
    });

    const note = {
      id: "prompt_choice_1",
      type: "PROMPT_CHOICE",
      payload: {
        event: {
          id: "prompt_choice_1",
          type: "PROMPT_CHOICE",
          playerId: "player_1",
          status: "DECLARED",
          data: {
            userDecisionMade: false,
            headerText: "Confirm",
            promptText: "Choose one",
            availableOptions: [{ index: 0, label: "Yes" }],
          },
        },
      },
    };

    const raw = { gameEnv: { notificationQueue: [note] } };
    const handlePromise = manager.handleNotification(note as any, raw as any);

    await shownConfig.buttons[0].onClick();

    expect(confirmOptionChoice).toHaveBeenCalledTimes(1);
    expect(promptChoiceDialog.hide).toHaveBeenCalledTimes(1);
    expect(promptChoiceDialog.show).toHaveBeenCalledTimes(2);
    expect(onReportError).toHaveBeenCalledTimes(1);

    await shownConfig.buttons[0].onClick();
    await handlePromise;

    expect(confirmOptionChoice).toHaveBeenCalledTimes(2);
    expect(updateGameStatus).toHaveBeenCalledTimes(1);
    expect(promptChoiceDialog.hide).toHaveBeenCalledTimes(2);
    expect(promptChoiceDialog.show).toHaveBeenCalledTimes(2);
  });
});
