import { describe, expect, it } from "vitest";
import { resolveDialogActionButtonPalette } from "../src/phaser/ui/dialog/DialogStyleTokens";

describe("resolveDialogActionButtonPalette", () => {
  it("keeps default palette unchanged for enabled buttons", () => {
    expect(resolveDialogActionButtonPalette(true, "default")).toMatchObject({
      fillColor: 0x353a43,
      borderColor: 0x8ea8ff,
      textColor: "#f5f6f7",
      alpha: 1,
    });
  });

  it("applies stronger emphasis to primary top/bottom button", () => {
    expect(resolveDialogActionButtonPalette(true, "primaryTopBottom")).toMatchObject({
      fillColor: 0x273b6d,
      borderColor: 0x7ea7ff,
      textColor: "#f7fbff",
    });
  });

  it("uses muted palette when disabled regardless of variant", () => {
    expect(resolveDialogActionButtonPalette(false, "secondaryTopBottom")).toMatchObject({
      fillColor: 0x2f3238,
      borderColor: 0x5b6068,
      textColor: "#98a0aa",
      alpha: 0.45,
    });
  });
});
