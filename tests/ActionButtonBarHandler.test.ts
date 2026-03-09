import { describe, expect, it, vi } from "vitest";

vi.mock("phaser", () => {
  class Rectangle {
    constructor(
      public x: number,
      public y: number,
      public width: number,
      public height: number,
    ) {}

    contains(px: number, py: number) {
      return px >= this.x && px <= this.x + this.width && py >= this.y && py <= this.y + this.height;
    }
  }

  return {
    default: {
      Math: {
        Clamp: (value: number, min: number, max: number) => Math.min(Math.max(value, min), max),
      },
      Geom: {
        Rectangle,
      },
      Display: {
        Color: {
          HexStringToColor: (value: string) => ({
            color: Number.parseInt(value.replace("#", ""), 16) || 0,
          }),
        },
      },
    },
  };
});

import { ActionExecutor } from "../src/phaser/controllers/ActionExecutor";
import { ActionButtonBarHandler } from "../src/phaser/ui/ActionButtonBarHandler";

class FakeGameObject {
  interactive = false;
  visible = true;
  width = 0;
  height = 0;
  x = 0;
  y = 0;
  depth = 0;
  alpha = 1;
  mask: unknown;
  children: unknown[] = [];
  private handlers = new Map<string, (...args: any[]) => any>();

  constructor(init: Partial<FakeGameObject> = {}) {
    Object.assign(this, init);
  }

  setDepth(depth: number) {
    this.depth = depth;
    return this;
  }

  setVisible(visible: boolean) {
    this.visible = visible;
    return this;
  }

  setInteractive(_opts?: any) {
    this.interactive = true;
    return this;
  }

  disableInteractive() {
    this.interactive = false;
    return this;
  }

  setOrigin(_x?: number, _y?: number) {
    return this;
  }

  setAlpha(alpha: number) {
    this.alpha = alpha;
    return this;
  }

  setX(x: number) {
    this.x = x;
    return this;
  }

  setMask(mask: unknown) {
    this.mask = mask;
    return this;
  }

  add(child: unknown) {
    this.children.push(child);
    return this;
  }

  on(event: string, handler: (...args: any[]) => any) {
    this.handlers.set(event, handler);
    return this;
  }

  async emit(event: string, ...args: any[]) {
    if (event.startsWith("pointer") && !this.interactive) {
      return undefined;
    }
    const handler = this.handlers.get(event);
    return handler ? await handler(...args) : undefined;
  }

  destroy() {
    return this;
  }

  fillStyle(_color?: number, _alpha?: number) {
    return this;
  }

  fillRoundedRect(_x?: number, _y?: number, _w?: number, _h?: number, _radius?: number) {
    return this;
  }

  lineStyle(_width?: number, _color?: number, _alpha?: number) {
    return this;
  }

  strokeRoundedRect(_x?: number, _y?: number, _w?: number, _h?: number, _radius?: number) {
    return this;
  }

  clear() {
    return this;
  }

  fillRect(_x?: number, _y?: number, _w?: number, _h?: number) {
    return this;
  }

  createGeometryMask() {
    return {};
  }
}

function createScene() {
  return {
    scale: { width: 1280, height: 720 },
    cameras: { main: { centerX: 640, centerY: 360, width: 1280, height: 720 } },
    add: {
      graphics: (init: { x?: number; y?: number } = {}) => new FakeGameObject({ x: init.x ?? 0, y: init.y ?? 0 }),
      text: (x: number, y: number, text: string) =>
        new FakeGameObject({ x, y, width: Math.max(40, String(text).length * 9) }),
      rectangle: (x: number, y: number, width: number, height: number) =>
        new FakeGameObject({ x, y, width, height }),
      container: (x: number, y: number) => new FakeGameObject({ x, y }),
    },
    tweens: {
      add: vi.fn(() => ({ remove: vi.fn() })),
    },
    input: {
      on: vi.fn(),
      activePointer: { x: 0, y: 0 },
    },
    events: {
      on: vi.fn(),
    },
    time: {
      now: 0,
    },
  };
}

function createHandler(
  descriptors: Array<{ label: string; onClick?: () => Promise<void> | void; enabled?: boolean; primary?: boolean }>,
) {
  const scene = createScene();
  const handler = new ActionButtonBarHandler(scene as any);
  handler.setDescriptors(descriptors);
  return {
    scene,
    handler,
    hitAreas: (handler as any).hitAreas as FakeGameObject[],
  };
}

function click(hitArea: FakeGameObject) {
  return hitArea.emit("pointerup", {}, 0, 0, { stopPropagation: vi.fn() });
}

describe("ActionButtonBarHandler", () => {
  it("ignores repeated taps on the same button while its action is in flight", async () => {
    let release!: () => void;
    const onClick = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const { handler, hitAreas } = createHandler([{ label: "Attack", onClick }]);
    const [attackButton] = hitAreas;

    const firstTap = click(attackButton);

    expect(onClick).toHaveBeenCalledTimes(1);
    expect((handler as any).actionInFlight).toBe(true);
    expect(hitAreas.every((hit) => hit.interactive === false)).toBe(true);

    const secondTap = click(attackButton);

    expect(onClick).toHaveBeenCalledTimes(1);

    release();
    await Promise.all([firstTap, secondTap]);

    expect((handler as any).actionInFlight).toBe(false);
    expect(hitAreas.every((hit) => hit.interactive === true)).toBe(true);
  });

  it("disables every action-bar button while one action is still running", async () => {
    let release!: () => void;
    const firstAction = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const secondAction = vi.fn(async () => undefined);
    const { hitAreas } = createHandler([
      { label: "Play", onClick: firstAction },
      { label: "Skip", onClick: secondAction },
    ]);
    const [playButton, skipButton] = hitAreas;

    const firstTap = click(playButton);

    expect(firstAction).toHaveBeenCalledTimes(1);
    expect(hitAreas.every((hit) => hit.interactive === false)).toBe(true);

    await click(skipButton);

    expect(secondAction).not.toHaveBeenCalled();

    release();
    await firstTap;

    expect(hitAreas.every((hit) => hit.interactive === true)).toBe(true);
  });

  it("re-enables the action bar after a failed action so the user can retry", async () => {
    const onClick = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error("forced failure"))
      .mockResolvedValueOnce(undefined);
    const { handler, hitAreas } = createHandler([{ label: "Confirm", onClick }]);
    const [confirmButton] = hitAreas;

    await expect(click(confirmButton)).rejects.toThrow("forced failure");

    expect((handler as any).actionInFlight).toBe(false);
    expect(confirmButton.interactive).toBe(true);

    await click(confirmButton);

    expect(onClick).toHaveBeenCalledTimes(2);
    expect(confirmButton.interactive).toBe(true);
  });

  it("prevents duplicate playerAction requests from rapid action-bar taps", async () => {
    let releasePlayerAction!: () => void;
    const playerAction = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          releasePlayerAction = resolve;
        }),
    );
    const updateGameStatus = vi.fn(async () => undefined);
    const executor = new ActionExecutor({
      api: { playerAction } as any,
      engine: {
        getSnapshot: vi.fn(() => ({
          raw: {
            gameEnv: {
              currentBattle: { status: "ACTION_STEP" },
            },
          },
        })),
        updateGameStatus,
      } as any,
      gameContext: { gameId: "game_1", playerId: "player_1" } as any,
      attackCoordinator: { enter: vi.fn(), reset: vi.fn() } as any,
      getSelectedSlot: vi.fn(() => undefined),
      getOpponentRestedUnitSlots: vi.fn(() => []),
      getOpponentUnitSlots: vi.fn(() => []),
      getOpponentPlayerId: vi.fn(() => "player_2"),
      clearSelection: vi.fn(),
      refreshNeutral: vi.fn(),
      reportError: vi.fn(),
      onLoadingStart: vi.fn(),
      onLoadingEnd: vi.fn(),
    });
    const { hitAreas } = createHandler([
      {
        label: "Skip Action-Step",
        onClick: async () => {
          await executor.handleSkipAction();
        },
      },
    ]);
    const [skipButton] = hitAreas;

    const firstTap = click(skipButton);

    expect(playerAction).toHaveBeenCalledTimes(1);
    expect(updateGameStatus).not.toHaveBeenCalled();

    await click(skipButton);

    expect(playerAction).toHaveBeenCalledTimes(1);

    releasePlayerAction();
    await firstTap;

    expect(playerAction).toHaveBeenCalledTimes(1);
    expect(updateGameStatus).toHaveBeenCalledTimes(1);
    expect(updateGameStatus).toHaveBeenCalledWith("game_1", "player_1");
  });
});
