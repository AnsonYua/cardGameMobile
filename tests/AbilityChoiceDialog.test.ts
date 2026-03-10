import { beforeEach, describe, expect, it, vi } from "vitest";

const closeOrder: string[] = [];
let closeButton: any;
let closeLabel: any;

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
    setStrokeStyle: vi.fn(() => target),
    setOrigin: vi.fn(() => target),
    setY: vi.fn((y: number) => {
      target.y = y;
      return target;
    }),
    destroy: vi.fn(),
    y: 0,
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

vi.mock("../src/phaser/ui/CardDialogLayout", () => ({
  DEFAULT_CARD_DIALOG_CONFIG: {
    z: { overlay: 1, dialog: 2 },
    dialog: { headerFontSize: 20, margin: 20 },
  },
  computePromptDialogLayout: vi.fn(() => ({
    dialogWidth: 400,
    dialogHeight: 240,
    headerOffset: 24,
    headerGap: 14,
  })),
  createDialogShell: vi.fn((_scene: any, _cfg: any, _layout: any, _opts: any) => {
    closeButton = createInteractiveTarget();
    closeLabel = createInteractiveTarget();
    return {
      dialog: { destroy: vi.fn() },
      header: { height: 24 },
      content: { add: vi.fn() },
      closeButton,
      closeLabel,
    };
  }),
}));

import { AbilityChoiceDialog } from "../src/phaser/ui/AbilityChoiceDialog";

describe("AbilityChoiceDialog", () => {
  beforeEach(() => {
    closeOrder.length = 0;
    closeButton = undefined;
    closeLabel = undefined;
    vi.clearAllMocks();
  });

  it("dismisses before submit and ignores rapid double clicks", async () => {
    const rowTargets: any[] = [];
    const scene = {
      cameras: { main: { width: 1280, height: 720, centerX: 640, centerY: 360 } },
      add: {
        text: vi.fn((_x: number, _y: number, text: string) => ({
          width: String(text ?? "").length * 8,
          height: 20,
          y: 0,
          setOrigin() {
            return this;
          },
          setY(y: number) {
            this.y = y;
            return this;
          },
          destroy: vi.fn(),
        })),
        rectangle: vi.fn((_x: number, y: number) => {
          const target = createInteractiveTarget();
          target.y = y;
          rowTargets.push(target);
          return target;
        }),
      },
    } as any;
    const callback = vi.fn(async () => {
      expect(rowTargets[0].disableInteractive).toHaveBeenCalled();
      expect(closeButton.disableInteractive).toHaveBeenCalled();
      closeOrder.push("callback");
    });
    const dialog = new AbilityChoiceDialog(scene);

    dialog.show({
      groups: [{ options: [{ label: "Activate", onClick: callback }] }],
    });

    await Promise.all([rowTargets[0].trigger("pointerup"), rowTargets[0].trigger("pointerup")]);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(closeOrder).toEqual(["animateOutStart", "animateOutDone", "callback"]);
    expect(closeLabel.disableInteractive).toHaveBeenCalled();
  });

  it("stays dismissed when the submit callback fails", async () => {
    const rowTargets: any[] = [];
    const scene = {
      cameras: { main: { width: 1280, height: 720, centerX: 640, centerY: 360 } },
      add: {
        text: vi.fn((_x: number, _y: number, text: string) => ({
          width: String(text ?? "").length * 8,
          height: 20,
          y: 0,
          setOrigin() {
            return this;
          },
          setY(y: number) {
            this.y = y;
            return this;
          },
          destroy: vi.fn(),
        })),
        rectangle: vi.fn((_x: number, y: number) => {
          const target = createInteractiveTarget();
          target.y = y;
          rowTargets.push(target);
          return target;
        }),
      },
    } as any;
    const dialog = new AbilityChoiceDialog(scene);

    dialog.show({
      groups: [{ options: [{ label: "Activate", onClick: vi.fn(async () => Promise.reject(new Error("boom"))) }] }],
    });

    await expect(rowTargets[0].trigger("pointerup")).rejects.toThrow("boom");
    expect((dialog as any).container).toBeUndefined();
  });
});
