import { beforeEach, describe, expect, it, vi } from "vitest";

const closeOrder: string[] = [];
let shownButtons: Array<{ onClick?: () => Promise<void> | void }> = [];

vi.mock("../src/phaser/ui/dialog/SimplePromptModal", () => ({
  SimplePromptModal: class {
    show = vi.fn((opts: any) => {
      shownButtons = opts.buttons ?? [];
      return {};
    });
    hide = vi.fn(async () => {
      closeOrder.push("hide");
    });
  },
}));

import { GameOverDialog } from "../src/phaser/ui/GameOverDialog";

describe("GameOverDialog", () => {
  beforeEach(() => {
    closeOrder.length = 0;
    shownButtons = [];
    vi.clearAllMocks();
  });

  it("hides before running onOk", async () => {
    const dialog = new GameOverDialog({} as any);
    const onOk = vi.fn(async () => {
      closeOrder.push("onOk");
    });

    dialog.show({ isWinner: true, onOk });
    await shownButtons[0]?.onClick?.();

    expect(onOk).toHaveBeenCalledTimes(1);
    expect(closeOrder.slice(-2)).toEqual(["hide", "onOk"]);
  });

  it("ignores rapid double click on OK", async () => {
    const dialog = new GameOverDialog({} as any);
    const onOk = vi.fn(async () => undefined);

    dialog.show({ isWinner: false, onOk });
    const firstClick = Promise.resolve(shownButtons[0]?.onClick?.());
    const secondClick = Promise.resolve(shownButtons[0]?.onClick?.());

    await Promise.all([firstClick, secondClick]);

    expect(onOk).toHaveBeenCalledTimes(1);
  });
});
