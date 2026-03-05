import { beforeEach, describe, expect, it, vi } from "vitest";

const closeOrder: string[] = [];
let promptButtons: Array<{ onClick: () => Promise<void> | void }> = [];

vi.mock("../src/phaser/ui/DialogAnimator", () => ({
  animateDialogIn: vi.fn(),
  animateDialogOut: vi.fn((_scene: any, _target: any, onComplete?: () => void) => {
    closeOrder.push("animateOutStart");
    onComplete?.();
    closeOrder.push("animateOutDone");
  }),
}));

vi.mock("../src/phaser/ui/DialogTimerPresenter", () => ({
  DialogTimerPresenter: class {
    attach = vi.fn();
    stop = vi.fn();
  },
}));

vi.mock("../src/phaser/ui/PromptDialog", () => ({
  createPromptDialog: vi.fn((_scene: any, _cfg: any, opts: any) => {
    promptButtons = opts.buttons;
    return {
      dialog: { destroy: vi.fn() },
      buttons: opts.buttons.map(() => ({ rect: { disableInteractive: vi.fn() } })),
      layout: {},
    };
  }),
}));

import { animateDialogOut } from "../src/phaser/ui/DialogAnimator";
import { TimedPromptDialog } from "../src/phaser/ui/TimedPromptDialog";

describe("TimedPromptDialog close order", () => {
  beforeEach(() => {
    closeOrder.length = 0;
    promptButtons = [];
    vi.clearAllMocks();
  });

  it("runs callback after close animation starts/completes", async () => {
    const callback = vi.fn(async () => {
      closeOrder.push("callback");
    });
    const dialog = new TimedPromptDialog<string>({} as any);

    const resultPromise = dialog.showPrompt({
      headerText: "Confirm",
      promptText: "Proceed?",
      buttons: [{ label: "Yes", result: "YES", onClick: callback }],
      timeoutResult: "YES",
    });

    await promptButtons[0]?.onClick?.();
    const result = await resultPromise;

    expect(result).toBe("YES");
    expect(callback).toHaveBeenCalledTimes(1);
    expect(closeOrder).toEqual(["animateOutStart", "animateOutDone", "callback"]);
  });

  it("ignores double click while close is already in progress", async () => {
    let releaseClose: (() => void) | undefined;
    (animateDialogOut as any).mockImplementation((_scene: any, _target: any, onComplete?: () => void) => {
      closeOrder.push("animateOutStart");
      releaseClose = () => {
        onComplete?.();
        closeOrder.push("animateOutDone");
      };
    });

    const callback = vi.fn(async () => {
      closeOrder.push("callback");
    });
    const dialog = new TimedPromptDialog<string>({} as any);

    const resultPromise = dialog.showPrompt({
      headerText: "Confirm",
      promptText: "Proceed?",
      buttons: [{ label: "Yes", result: "YES", onClick: callback }],
      timeoutResult: "YES",
    });

    const firstClick = Promise.resolve(promptButtons[0]?.onClick?.());
    const secondClick = Promise.resolve(promptButtons[0]?.onClick?.());

    expect(callback).toHaveBeenCalledTimes(0);
    releaseClose?.();

    await Promise.all([firstClick, secondClick]);
    const result = await resultPromise;

    expect(result).toBe("YES");
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
