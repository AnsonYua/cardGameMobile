import { describe, expect, test, vi } from "vitest";

vi.mock("phaser", () => {
  class EventEmitter {
    on() {}
    once() {}
    off() {}
    emit() {}
  }

  return {
    default: {
      Events: {
        EventEmitter,
      },
    },
  };
});

import { GameEngine } from "./GameEngine";
import { GameContextStore } from "./GameContextStore";

describe("GameEngine updateGameStatus sequencing", () => {
  test("serializes overlapping refresh calls in FIFO order", async () => {
    const contextStore = new GameContextStore();
    const engine = new GameEngine({} as any, { getApiBaseUrl: () => "" } as any, contextStore);

    const started: number[] = [];
    const finished: number[] = [];
    let active = 0;
    let maxActive = 0;
    let releaseFirst!: () => void;

    (engine as any).performUpdateGameStatus = vi
      .fn()
      .mockImplementationOnce(async () => {
        started.push(1);
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise<void>((resolve) => {
          releaseFirst = resolve;
        });
        active -= 1;
        finished.push(1);
        return { status: "first", raw: null, previousRaw: null };
      })
      .mockImplementationOnce(async () => {
        started.push(2);
        active += 1;
        maxActive = Math.max(maxActive, active);
        active -= 1;
        finished.push(2);
        return { status: "second", raw: null, previousRaw: null };
      });

    const first = engine.updateGameStatus("game_1", "player_1");
    const second = engine.updateGameStatus("game_1", "player_1");

    await Promise.resolve();
    expect(started).toEqual([1]);

    releaseFirst();

    const firstResult = await first;
    const secondResult = await second;

    expect(firstResult.status).toBe("first");
    expect(secondResult.status).toBe("second");
    expect(started).toEqual([1, 2]);
    expect(finished).toEqual([1, 2]);
    expect(maxActive).toBe(1);
  });
});
