import { describe, expect, it, vi } from "vitest";
import { showPromptChoiceDialog } from "../src/phaser/controllers/choice/PromptChoiceDialogRouter";

describe("showPromptChoiceDialog", () => {
  it("routes PROMPT_CHOICE with card display metadata to card-style choices", () => {
    const promptChoiceDialog = {
      show: vi.fn(),
      hide: vi.fn(),
      isOpen: vi.fn(() => false),
    };
    const topDeckSelectionReviewDialog = {
      show: vi.fn(),
      hide: vi.fn(),
      isOpen: vi.fn(() => false),
    };

    showPromptChoiceDialog({
      entry: {
        data: {
          headerText: "Top of Deck",
          promptText: "Choose 1 card to keep on top of your deck.",
          availableOptions: [
            {
              index: 0,
              label: "Gundam",
              payload: { action: "KEEP_CARD", carduid: "GD01-001_top_0001" },
              display: { mode: "card", cardId: "GD01-001", label: "Gundam" },
            },
            {
              index: 1,
              label: "Unicorn Gundam",
              payload: { action: "KEEP_CARD", carduid: "GD01-002_top_0002" },
              display: { mode: "card", cardId: "GD01-002", label: "Unicorn Gundam" },
            },
          ],
        },
      },
      promptChoiceDialog: promptChoiceDialog as any,
      topDeckSelectionReviewDialog: topDeckSelectionReviewDialog as any,
      onSubmit: async () => {},
      resolveTimeoutIndex: () => 0,
    });

    expect(promptChoiceDialog.show).toHaveBeenCalledTimes(1);
    const args = promptChoiceDialog.show.mock.calls[0][0];
    expect(args.choices).toBeTruthy();
    expect(args.choices).toHaveLength(2);
    expect(args.optionActions).toEqual([
      { index: 0, action: "KEEP_CARD" },
      { index: 1, action: "KEEP_CARD" },
    ]);
    expect(args.choices[0]).toMatchObject({
      index: 0,
      mode: "card",
      cardId: "GD01-001",
      label: "Gundam",
      enabled: true,
    });
    expect(topDeckSelectionReviewDialog.hide).toHaveBeenCalledTimes(1);
  });

  it("keeps text-only PROMPT_CHOICE on the existing button-style dialog", () => {
    const promptChoiceDialog = {
      show: vi.fn(),
      hide: vi.fn(),
      isOpen: vi.fn(() => false),
    };
    const topDeckSelectionReviewDialog = {
      show: vi.fn(),
      hide: vi.fn(),
      isOpen: vi.fn(() => false),
    };

    showPromptChoiceDialog({
      entry: {
        data: {
          headerText: "Choose Option",
          promptText: "Put the card on top or bottom?",
          availableOptions: [
            { index: 0, label: "Top", payload: { action: "TOP" }, display: { mode: "text", label: "Top" } },
            { index: 1, label: "Bottom", payload: { action: "BOTTOM" }, display: { mode: "text", label: "Bottom" } },
          ],
        },
      },
      promptChoiceDialog: promptChoiceDialog as any,
      topDeckSelectionReviewDialog: topDeckSelectionReviewDialog as any,
      onSubmit: async () => {},
      resolveTimeoutIndex: () => 0,
    });

    expect(promptChoiceDialog.show).toHaveBeenCalledTimes(1);
    const args = promptChoiceDialog.show.mock.calls[0][0];
    expect(args.choices).toBeUndefined();
    expect(args.buttons).toHaveLength(2);
    expect(args.optionActions).toEqual([
      { index: 0, action: "TOP" },
      { index: 1, action: "BOTTOM" },
    ]);
  });

  it("maps scry top/bottom prompt to card-capable choices from raw snapshot context", () => {
    const promptChoiceDialog = {
      show: vi.fn(),
      hide: vi.fn(),
      isOpen: vi.fn(() => false),
    };
    const topDeckSelectionReviewDialog = {
      show: vi.fn(),
      hide: vi.fn(),
      isOpen: vi.fn(() => false),
    };

    showPromptChoiceDialog({
      entry: {
        data: {
          headerText: "Top of Deck",
          promptText: "Put the card on top or bottom of your deck?",
          context: { kind: "SCRY_TOP_DECK", lookedCarduids: ["GD01-023_top_0001"] },
          availableOptions: [
            { index: 0, label: "Top", payload: { action: "TOP" }, display: { mode: "text", label: "Top" } },
            { index: 1, label: "Bottom", payload: { action: "BOTTOM" }, display: { mode: "text", label: "Bottom" } },
          ],
        },
      },
      rawSnapshot: {
        gameEnv: {
          processingQueue: [
            {
              type: "PROMPT_CHOICE",
              data: {
                context: { kind: "SCRY_TOP_DECK", lookedCarduids: ["GD01-023_top_0001"] },
              },
            },
          ],
          players: {},
        },
      },
      promptChoiceDialog: promptChoiceDialog as any,
      topDeckSelectionReviewDialog: topDeckSelectionReviewDialog as any,
      onSubmit: async () => {},
      resolveTimeoutIndex: () => 0,
    });

    expect(promptChoiceDialog.show).toHaveBeenCalledTimes(1);
    const args = promptChoiceDialog.show.mock.calls[0][0];
    expect(args.choices).toBeTruthy();
    expect(args.choices).toHaveLength(2);
    expect(args.choices[0]).toMatchObject({
      mode: "card",
      cardId: "GD01-023",
    });
  });

  it("keeps top-deck selection review prompt on TopDeckSelectionReviewDialog", () => {
    const promptChoiceDialog = {
      show: vi.fn(),
      hide: vi.fn(),
      isOpen: vi.fn(() => false),
    };
    const topDeckSelectionReviewDialog = {
      show: vi.fn(),
      hide: vi.fn(),
      isOpen: vi.fn(() => false),
    };

    showPromptChoiceDialog({
      entry: {
        data: {
          headerText: "Top of Deck",
          promptText: "Review the looked cards, then continue.",
          availableOptions: [{ index: 0, label: "Continue" }],
          context: {
            kind: "TOP_DECK_SELECTION_REVIEW_CONFIRM",
            topDeckSelection: {
              lookedCards: [{ carduid: "a", cardId: "GD01-001", name: "Gundam", matchesFilters: true }],
            },
          },
        },
      },
      promptChoiceDialog: promptChoiceDialog as any,
      topDeckSelectionReviewDialog: topDeckSelectionReviewDialog as any,
      onSubmit: async () => {},
      resolveTimeoutIndex: () => 0,
    });

    expect(promptChoiceDialog.hide).toHaveBeenCalledTimes(1);
    expect(topDeckSelectionReviewDialog.show).toHaveBeenCalledTimes(1);
  });
});
