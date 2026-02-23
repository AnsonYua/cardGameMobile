import { describe, expect, it } from "vitest";
import {
  getTargetCardCore,
  getTargetCardId,
  normalizeTargetForRender,
} from "../src/phaser/controllers/targeting/TargetCardNormalization";

describe("TargetCardNormalization", () => {
  it("resolves core card data from canonical shape", () => {
    const target = { cardData: { id: "GD03-044", cardType: "unit", ap: 2, hp: 3 } };
    expect(getTargetCardCore(target)).toEqual(target.cardData);
    expect(getTargetCardId(target)).toBe("GD03-044");
  });

  it("resolves core card data from nested legacy shape", () => {
    const target = {
      cardData: {
        carduid: "GD03-045_shield_p1_0002",
        cardId: "GD03-045",
        cardData: { id: "GD03-045", cardType: "unit", ap: 2, hp: 4 },
      },
    };

    expect(getTargetCardCore(target)).toEqual(target.cardData.cardData);
    expect(getTargetCardId(target)).toBe("GD03-045");
  });

  it("normalizes nested target to flattened render shape", () => {
    const target = {
      carduid: "GD03-045_shield_p1_0002",
      cardData: {
        cardId: "GD03-045",
        cardData: { id: "GD03-045", cardType: "unit" },
      },
    };

    const normalized = normalizeTargetForRender(target);
    expect(normalized.cardData).toEqual({ id: "GD03-045", cardType: "unit" });
    expect(getTargetCardId(normalized)).toBe("GD03-045");
  });

  it("falls back to UID when no card ID is available", () => {
    const target = { carduid: "UNKNOWN_UID_001" };
    expect(getTargetCardId(target)).toBe("UNKNOWN_UID_001");
  });

  it("derives card ID from zone-style UID when metadata is missing", () => {
    const target = { carduid: "GD03-044_shield_p1_0001" };
    expect(getTargetCardId(target)).toBe("GD03-044");
  });
});
