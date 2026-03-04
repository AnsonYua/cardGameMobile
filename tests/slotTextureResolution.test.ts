import { describe, expect, it } from "vitest";
import { resolveSlotTextureKey } from "../src/phaser/ui/SlotHiResTextureLoader";

describe("slot texture resolution", () => {
  it("prefers hi-res texture key when available", () => {
    const resolved = resolveSlotTextureKey({
      hiResTextureKey: "slot-hires-ST01-005",
      baseTextureKey: "ST01-005",
      hasTexture: (key) => key === "slot-hires-ST01-005" || key === "ST01-005",
    });
    expect(resolved).toBe("slot-hires-ST01-005");
  });

  it("falls back to base texture key when hi-res is missing", () => {
    const resolved = resolveSlotTextureKey({
      hiResTextureKey: "slot-hires-ST01-005",
      baseTextureKey: "ST01-005",
      hasTexture: (key) => key === "ST01-005",
    });
    expect(resolved).toBe("ST01-005");
  });

  it("returns available key candidate even when texture manager has not loaded it yet", () => {
    const resolved = resolveSlotTextureKey({
      hiResTextureKey: "slot-hires-ST01-005",
      baseTextureKey: "ST01-005",
      hasTexture: () => false,
    });
    expect(resolved).toBe("slot-hires-ST01-005");
  });
});
