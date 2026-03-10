import { beforeEach, describe, expect, it, vi } from "vitest";

let renderedFrames: any[] = [];
let shellDialog: any;
let shellOverlay: any;

function createInteractiveTarget() {
  let disabled = false;
  const handlers = new Map<string, () => Promise<void> | void>();
  const target = {
    disableInteractive: vi.fn(() => {
      disabled = true;
    }),
    setInteractive: vi.fn(() => target),
    on: vi.fn((event: string, handler: () => Promise<void> | void) => {
      handlers.set(event, handler);
      return target;
    }),
    setStrokeStyle: vi.fn(() => target),
    trigger: async (event: string) => {
      if (disabled) return;
      await handlers.get(event)?.();
    },
    destroy: vi.fn(),
  };
  return target;
}

vi.mock("../src/phaser/ui/PreviewController", () => ({
  PreviewController: class {
    isActive = vi.fn(() => false);
    cancelPending = vi.fn();
    hide = vi.fn();
    start = vi.fn();
  },
}));

vi.mock("../src/phaser/ui/DialogTimerPresenter", () => ({
  DialogTimerPresenter: class {
    attach = vi.fn();
    stop = vi.fn();
  },
}));

vi.mock("../src/phaser/ui/MultiTargetDialog", () => ({
  MultiTargetDialog: class {
    hide = vi.fn(async () => undefined);
    isOpen = vi.fn(() => false);
  },
}));

vi.mock("../src/phaser/ui/ScrollList", () => ({
  ScrollList: class {
    destroy = vi.fn();
    shouldSuppressClick = vi.fn(() => false);
  },
}));

vi.mock("../src/phaser/ui/dialogUtils", () => ({
  computeDialogHeaderLayout: vi.fn(() => ({
    height: 24,
    headerOffsetUsed: 28,
    style: {},
  })),
  computeScrollMaskOverflowX: vi.fn(() => 0),
}));

vi.mock("../src/phaser/ui/TargetDialogShell", () => ({
  createTargetDialogShell: vi.fn(() => {
    shellOverlay = { destroy: vi.fn() };
    shellDialog = {
      destroy: vi.fn(),
      add: vi.fn(),
      setDepth: vi.fn(function () {
        return this;
      }),
    };
    return {
      overlay: shellOverlay,
      dialog: shellDialog,
      content: { add: vi.fn() },
    };
  }),
}));

vi.mock("../src/phaser/ui/TargetDialogRenderPolicy", () => ({
  shouldUseBoardSlotSprite: vi.fn(() => false),
}));

vi.mock("../src/phaser/ui/TargetDialogSlotRenderer", () => ({
  renderTargetDialogSlot: vi.fn(),
}));

import { PilotTargetDialog } from "../src/phaser/ui/PilotTargetDialog";

describe("PilotTargetDialog", () => {
  beforeEach(() => {
    renderedFrames = [];
    shellDialog = undefined;
    shellOverlay = undefined;
    vi.clearAllMocks();
  });

  function createScene() {
    return {
      cameras: { main: { width: 1280, height: 720 } },
      add: {
        existing: vi.fn(),
        text: vi.fn((_x: number, _y: number, _text: string) => ({
          setVisible() {
            return this;
          },
          setOrigin() {
            return this;
          },
          getBounds() {
            return { height: 20 };
          },
          destroy: vi.fn(),
        })),
        rectangle: vi.fn(() => {
          const frame = createInteractiveTarget();
          renderedFrames.push(frame);
          return frame;
        }),
      },
    } as any;
  }

  it("hides before running onSelect", async () => {
    const dialog = new PilotTargetDialog(createScene());
    const onSelect = vi.fn(async () => {
      expect(shellDialog.destroy).toHaveBeenCalledTimes(1);
      expect(shellOverlay.destroy).toHaveBeenCalledTimes(1);
    });

    dialog.show({
      targets: [{ owner: "player", slotId: "slot1", unit: { cardUid: "unit_1" } } as any],
      onSelect,
    });

    await renderedFrames[0].trigger("pointerup");

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("ignores rapid double click on the same target", async () => {
    const dialog = new PilotTargetDialog(createScene());
    const onSelect = vi.fn(async () => undefined);

    dialog.show({
      targets: [{ owner: "player", slotId: "slot1", unit: { cardUid: "unit_1" } } as any],
      onSelect,
    });

    const firstClick = renderedFrames[0].trigger("pointerup");
    const secondClick = renderedFrames[0].trigger("pointerup");
    await Promise.all([firstClick, secondClick]);

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("does not fire onClose on successful selection", async () => {
    const dialog = new PilotTargetDialog(createScene());
    const onClose = vi.fn();

    dialog.show({
      targets: [{ owner: "player", slotId: "slot1", unit: { cardUid: "unit_1" } } as any],
      onSelect: vi.fn(async () => undefined),
      onClose,
    });

    await renderedFrames[0].trigger("pointerup");

    expect(onClose).not.toHaveBeenCalled();
  });
});
