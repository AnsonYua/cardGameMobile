import { describe, expect, it } from "vitest";
import { computeContainSize, computeDisplaySizeFromTexture, getTextureSourceSize } from "../src/phaser/ui/cardSizing";

function makeScene(source?: { width?: number; height?: number }, exists = true) {
  return {
    textures: {
      exists: () => exists,
      get: () => ({
        getSourceImage: () => source,
      }),
    },
  };
}

describe("cardSizing", () => {
  it("fits wider sources by width in contain mode", () => {
    const result = computeContainSize(200, 100, 100, 100);
    expect(result).toEqual({ width: 100, height: 50 });
  });

  it("fits taller sources by height in contain mode", () => {
    const result = computeContainSize(100, 200, 100, 100);
    expect(result).toEqual({ width: 50, height: 100 });
  });

  it("reads source dimensions from texture manager when available", () => {
    const scene = makeScene({ width: 420, height: 640 });
    expect(getTextureSourceSize(scene, "any-key")).toEqual({ width: 420, height: 640 });
  });

  it("returns null when source dimensions are missing or invalid", () => {
    const missingScene = makeScene(undefined, false);
    expect(getTextureSourceSize(missingScene, "missing")).toBeNull();

    const invalidScene = makeScene({ width: 0, height: -1 });
    expect(getTextureSourceSize(invalidScene, "bad")).toBeNull();
  });

  it("falls back to aspect-based contain size when texture source is unavailable", () => {
    const scene = makeScene(undefined, false);
    const result = computeDisplaySizeFromTexture(scene, "card", 85, 110, 63 / 88);
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
    expect(result.width).toBeLessThanOrEqual(85);
    expect(result.height).toBeLessThanOrEqual(110);
  });
});
