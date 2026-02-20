import { describe, expect, it } from "vitest";
import { resolveDialogHeaderGap } from "../src/phaser/ui/dialog/DialogHeaderGap";
import { getDialogTimerHeaderGap } from "../src/phaser/ui/timerBarStyles";

describe("resolveDialogHeaderGap", () => {
  it("uses timer gap when timer is shown", () => {
    expect(resolveDialogHeaderGap(true, 14)).toBe(getDialogTimerHeaderGap());
  });

  it("uses provided default gap when timer is hidden", () => {
    expect(resolveDialogHeaderGap(false, 14)).toBe(14);
  });
});
