import { EventEmitter } from "events";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildSlotHiResCandidateUrls,
  buildSlotHiResTextureKey,
  deriveSetIdFromCardId,
  SlotHiResTextureLoader,
} from "../src/phaser/ui/SlotHiResTextureLoader";

function createFakeScene() {
  const textures = new Map<string, { width: number; height: number }>();
  const loader = new EventEmitter() as EventEmitter & {
    queue: Array<{ key: string; url: string }>;
    loading: boolean;
    image: (key: string, url: string) => void;
    isLoading: () => boolean;
    start: () => void;
  };
  loader.queue = [];
  loader.loading = false;
  loader.image = (key: string, url: string) => {
    loader.queue.push({ key, url });
  };
  loader.isLoading = () => loader.loading;
  loader.start = () => {
    if (loader.loading) return;
    loader.loading = true;
    const queued = [...loader.queue];
    loader.queue = [];
    queueMicrotask(() => {
      queued.forEach(({ key }) => {
        textures.set(key, { width: 420, height: 640 });
        loader.emit(`filecomplete-image-${key}`);
      });
      loader.loading = false;
    });
  };
  const scene = {
    textures: {
      exists: (key: string) => textures.has(key),
      get: (key: string) => ({
        getSourceImage: () => textures.get(key),
      }),
    },
    load: loader,
  };
  return { scene: scene as any, textures, loader };
}

describe("SlotHiResTextureLoader", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    const urlCtor = globalThis.URL as any;
    urlCtor.createObjectURL = vi.fn(() => "blob:slot-hires");
    urlCtor.revokeObjectURL = vi.fn();
  });

  it("derives set id from known card ids", () => {
    expect(deriveSetIdFromCardId("ST01-005")).toBe("st01");
    expect(deriveSetIdFromCardId("GD02-015")).toBe("gd02");
    expect(deriveSetIdFromCardId("EXB-001")).toBe("exb");
    expect(deriveSetIdFromCardId("noseparator")).toBeNull();
  });

  it("builds candidate URLs in fixed priority order", () => {
    expect(buildSlotHiResCandidateUrls("http://localhost:8080", "st01", "ST01-005")).toEqual([
      "http://localhost:8080/api/game/image/st01/ST01-005.png",
      "http://localhost:8080/api/game/image/st01/ST01-005.jpeg",
      "http://localhost:8080/api/game/image/ST01-005.png",
      "http://localhost:8080/api/game/image/ST01-005.jpeg",
      "http://localhost:8080/api/game/image/previews/st01/ST01-005.jpeg",
    ]);
    expect(buildSlotHiResTextureKey("ST01-005")).toBe("slot-hires-v2-ST01-005");
  });

  it("deduplicates in-flight loads for the same card", async () => {
    const { scene } = createFakeScene();
    let releaseFetch: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      releaseFetch = resolve;
    });
    const fetchFn = vi.fn(async () => {
      await gate;
      return {
        ok: true,
        blob: async () => new Blob(["ok"], { type: "image/jpeg" }),
      } as Response;
    });
    const loader = new SlotHiResTextureLoader(scene, {
      baseUrl: "http://localhost:8080",
      fetchFn: fetchFn as any,
    });

    const first = loader.ensureLoaded("ST01-005");
    const second = loader.ensureLoaded("ST01-005");
    expect(fetchFn).toHaveBeenCalledTimes(1);
    releaseFetch?.();
    const [firstResult, secondResult] = await Promise.all([first, second]);
    expect(firstResult).toBe("slot-hires-v2-ST01-005");
    expect(secondResult).toBe("slot-hires-v2-ST01-005");
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("respects fail cooldown before retrying failed candidates", async () => {
    const { scene } = createFakeScene();
    let now = 0;
    const fetchFn = vi.fn(async () => ({ ok: false } as Response));
    const loader = new SlotHiResTextureLoader(scene, {
      baseUrl: "http://localhost:8080",
      fetchFn: fetchFn as any,
      nowFn: () => now,
      failCooldownMs: 30_000,
    });

    expect(await loader.ensureLoaded("GD02-015")).toBeNull();
    expect(fetchFn).toHaveBeenCalledTimes(5);

    expect(await loader.ensureLoaded("GD02-015")).toBeNull();
    expect(fetchFn).toHaveBeenCalledTimes(5);

    now = 30_001;
    expect(await loader.ensureLoaded("GD02-015")).toBeNull();
    expect(fetchFn).toHaveBeenCalledTimes(10);
  });
});
