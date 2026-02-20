import { describe, expect, it } from "vitest";
import { mapTokenChoiceToDialogView } from "../src/phaser/controllers/choice/TokenChoiceViewMapper";

describe("mapTokenChoiceToDialogView", () => {
  it("prefers explicit display cardId", () => {
    const view = mapTokenChoiceToDialogView({
      index: 1,
      display: { mode: "card", cardId: "T-011", label: "Fatum-00" },
      tokenData: { id: "T-999" },
    });

    expect(view).toEqual({
      index: 1,
      cardId: "T-011",
      enabled: true,
    });
  });

  it("falls back to tokenData.id when display is absent", () => {
    const view = mapTokenChoiceToDialogView({
      index: 0,
      tokenData: { id: "T-020" },
      enabled: true,
    });

    expect(view).toEqual({
      index: 0,
      cardId: "T-020",
      enabled: true,
    });
  });

  it("returns undefined cardId when no source exists", () => {
    const view = mapTokenChoiceToDialogView({
      index: 2,
      enabled: false,
    });

    expect(view).toEqual({
      index: 2,
      cardId: undefined,
      enabled: false,
    });
  });
});
