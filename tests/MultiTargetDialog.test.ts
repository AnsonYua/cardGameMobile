import { beforeEach, describe, expect, it, vi } from "vitest";

const closeOrder: string[] = [];
let timerHandler: (() => Promise<void> | void) | undefined;
let shellDialog: any;
let shellOverlay: any;
let rectangles: any[] = [];

function createInteractiveRect() {
  let disabled = false;
  const handlers = new Map<string, () => Promise<void> | void>();
  const rect = {
    setStrokeStyle: vi.fn(() => rect),
    setInteractive: vi.fn(() => {
      disabled = false;
      return rect;
    }),
    disableInteractive: vi.fn(() => {
      disabled = true;
      return rect;
    }),
    setAlpha: vi.fn(() => rect),
    on: vi.fn((event: string, handler: () => Promise<void> | void) => {
      handlers.set(event, handler);
      return rect;
    }),
    trigger: async (event: string) => {
      if (disabled) return;
      await handlers.get(event)?.();
    },
    setVisible: vi.fn(() => rect),
    destroy: vi.fn(),
  };
  rectangles.push(rect);
  return rect;
}

vi.mock("../src/phaser/ui/DialogTimerPresenter", () => ({
  DialogTimerPresenter: class {
    attach = vi.fn((_dialog: any, _layout: any, onTimeout?: () => Promise<void> | void) => {
      timerHandler = onTimeout;
    });
    stop = vi.fn();
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
    shellOverlay = { destroy: vi.fn(() => closeOrder.push("overlayDestroy")) };
    shellDialog = {
      destroy: vi.fn(() => closeOrder.push("dialogDestroy")),
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

import { MultiTargetDialog } from "../src/phaser/ui/MultiTargetDialog";

describe("MultiTargetDialog", () => {
  beforeEach(() => {
    closeOrder.length = 0;
    timerHandler = undefined;
    shellDialog = undefined;
    shellOverlay = undefined;
    rectangles = [];
    vi.clearAllMocks();
  });

  function createScene() {
    return {
      cameras: { main: { width: 1280, height: 720 } },
      add: {
        existing: vi.fn(),
        text: vi.fn(() => ({
          setOrigin() {
            return this;
          },
          setVisible() {
            return this;
          },
          setText() {
            return this;
          },
        })),
        rectangle: vi.fn(() => createInteractiveRect()),
        circle: vi.fn(() => ({
          setVisible() {
            return this;
          },
        })),
      },
    } as any;
  }

  function createDialog() {
    const previewController = {
      hide: vi.fn(),
      start: vi.fn(),
      isActive: vi.fn(() => false),
      cancelPending: vi.fn(),
    };
    const cfg = {
      z: { overlay: 1, dialog: 2 },
      overlayAlpha: 0.45,
      dialog: {
        cols: 3,
        rows: 2,
        margin: 12,
        gap: 16,
        widthFactor: 0.92,
        minWidth: 360,
        minHeight: 260,
        panelRadius: 18,
        extraHeight: 90,
        headerOffset: 34,
        closeSize: 22,
        closeOffset: 12,
        headerWrapPad: 20,
        scrollbarWidth: 8,
        scrollbarPad: 6,
        scrollbarMinThumb: 24,
      },
      card: {
        aspect: 88 / 64,
        widthFactor: 1,
        framePadding: 4,
        frameExtra: { w: 0, h: 20 },
        frameStroke: 0,
        frameColor: 0xffffff,
        extraCellHeight: 20,
      },
      badges: {},
    };
    return new MultiTargetDialog(createScene(), cfg as any, previewController as any);
  }

  it("hides before running confirm callback", async () => {
    const dialog = createDialog();
    const onConfirm = vi.fn(async () => {
      closeOrder.push("onConfirm");
      expect(shellDialog.destroy).toHaveBeenCalledTimes(1);
      expect(shellOverlay.destroy).toHaveBeenCalledTimes(1);
    });

    dialog.show({
      targets: [{ owner: "player", slotId: "slot1", unit: { cardUid: "unit_1" } } as any],
      onConfirm,
      min: 1,
      max: 1,
    });

    await rectangles[1].trigger("pointerup");
    await rectangles[0].trigger("pointerup");

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(closeOrder).toEqual(["overlayDestroy", "dialogDestroy", "onConfirm"]);
  });

  it("timer auto-confirm hides before running confirm callback", async () => {
    const dialog = createDialog();
    const onConfirm = vi.fn(async () => {
      closeOrder.push("onConfirm");
      expect(shellDialog.destroy).toHaveBeenCalledTimes(1);
    });

    dialog.show({
      targets: [{ owner: "player", slotId: "slot1", unit: { cardUid: "unit_1" } } as any],
      onConfirm,
      min: 1,
      max: 1,
    });

    await Promise.resolve(timerHandler?.());

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(closeOrder).toEqual(["overlayDestroy", "dialogDestroy", "onConfirm"]);
  });

  it("does not fire onClose on successful confirm", async () => {
    const dialog = createDialog();
    const onClose = vi.fn();

    dialog.show({
      targets: [{ owner: "player", slotId: "slot1", unit: { cardUid: "unit_1" } } as any],
      onConfirm: vi.fn(async () => undefined),
      onClose,
      min: 1,
      max: 1,
    });

    await rectangles[1].trigger("pointerup");
    await rectangles[0].trigger("pointerup");

    expect(onClose).not.toHaveBeenCalled();
  });
});
