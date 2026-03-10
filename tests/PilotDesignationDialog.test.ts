import { beforeEach, describe, expect, it, vi } from "vitest";

const closeOrder: string[] = [];
let promptButtons: Array<{ onClick: () => Promise<void> | void }> = [];
let closeButton: any;
let closeLabel: any;
let timeoutHandler: (() => Promise<void> | void) | undefined;

function createInteractiveTarget() {
  let disabled = false;
  const handlers = new Map<string, () => Promise<void> | void>();
  const target = {
    disableInteractive: vi.fn(() => {
      disabled = true;
    }),
    setInteractive: vi.fn(() => {
      disabled = false;
      return target;
    }),
    on: vi.fn((event: string, handler: () => Promise<void> | void) => {
      handlers.set(event, handler);
      return target;
    }),
    trigger: async (event: string) => {
      if (disabled) return;
      await handlers.get(event)?.();
    },
    destroy: vi.fn(),
  };
  return target;
}

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
    attach = vi.fn((_dialog: any, _layout: any, onTimeout?: () => Promise<void> | void) => {
      timeoutHandler = onTimeout;
    });
    stop = vi.fn();
  },
}));

vi.mock("../src/phaser/ui/PromptDialog", () => ({
  createPromptDialog: vi.fn((_scene: any, _cfg: any, opts: any) => {
    promptButtons = opts.buttons;
    closeButton = createInteractiveTarget();
    closeLabel = createInteractiveTarget();
    return {
      dialog: { destroy: vi.fn() },
      buttons: opts.buttons.map(() => ({ rect: createInteractiveTarget() })),
      closeButton,
      closeLabel,
      layout: {},
    };
  }),
}));

import { PilotDesignationDialog } from "../src/phaser/ui/PilotDesignationDialog";

describe("PilotDesignationDialog", () => {
  beforeEach(() => {
    closeOrder.length = 0;
    promptButtons = [];
    closeButton = undefined;
    closeLabel = undefined;
    timeoutHandler = undefined;
    vi.clearAllMocks();
  });

  it("dismisses before command submit and ignores double clicks", async () => {
    const onCommand = vi.fn(async () => {
      expect(closeButton.disableInteractive).toHaveBeenCalled();
      closeOrder.push("command");
    });
    const dialog = new PilotDesignationDialog({} as any);

    dialog.show({
      onPilot: vi.fn(),
      onCommand,
    });

    await Promise.all([promptButtons[1].onClick(), promptButtons[1].onClick()]);

    expect(onCommand).toHaveBeenCalledTimes(1);
    expect(closeLabel.disableInteractive).toHaveBeenCalled();
    expect(closeOrder).toEqual(["animateOutStart", "animateOutDone", "command"]);
  });

  it("runs the timer and click through the same lock", async () => {
    const onCommand = vi.fn(async () => {
      closeOrder.push("command");
    });
    const dialog = new PilotDesignationDialog({} as any);

    dialog.show({
      onPilot: vi.fn(),
      onCommand,
      allowPilot: false,
      allowCommand: true,
    });

    await Promise.all([promptButtons[0].onClick(), Promise.resolve(timeoutHandler?.())]);

    expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it("stays dismissed when command submit fails", async () => {
    const dialog = new PilotDesignationDialog({} as any);

    dialog.show({
      onPilot: vi.fn(),
      onCommand: vi.fn(async () => Promise.reject(new Error("boom"))),
    });

    await expect(promptButtons[1].onClick()).rejects.toThrow("boom");
    expect((dialog as any).container).toBeUndefined();
  });
});
