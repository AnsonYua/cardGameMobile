import { describe, expect, it } from "vitest";
import { mapOptionChoiceToDialogView } from "../src/phaser/controllers/choice/OptionChoiceViewMapper";

describe("mapOptionChoiceToDialogView", () => {
  it("uses explicit display contract for card mode", () => {
    const view = mapOptionChoiceToDialogView(
      {},
      {
        index: 0,
        label: "Reveal and add ST03-001 to hand",
        display: { mode: "card", cardId: "ST03-001", label: "Pick ST03-001" },
        payload: { action: "TAKE", carduid: "ST03-001_abc" },
      },
    );

    expect(view).toEqual({
      index: 0,
      mode: "card",
      cardId: "ST03-001",
      label: "Pick ST03-001",
      enabled: true,
    });
  });

  it("uses explicit display contract for text mode", () => {
    const view = mapOptionChoiceToDialogView(
      {},
      {
        index: 2,
        label: "Put it on the bottom of your deck",
        display: { mode: "text", label: "Bottom" },
        payload: { action: "BOTTOM" },
      },
    );

    expect(view.mode).toBe("text");
    expect(view.label).toBe("Bottom");
    expect(view.cardId).toBeUndefined();
  });

  it("falls back to payload cardId when display is missing", () => {
    const view = mapOptionChoiceToDialogView(
      {},
      {
        index: 1,
        label: "Deploy GD03-035",
        payload: { action: "DEPLOY", cardId: "GD03-035" },
      },
    );

    expect(view.mode).toBe("card");
    expect(view.cardId).toBe("GD03-035");
    expect(view.label).toBe("Deploy GD03-035");
  });
});
