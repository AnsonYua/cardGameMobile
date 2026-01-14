import type Phaser from "phaser";
import type { DialogLayout } from "./CardDialogLayout";
import { TimerBar } from "./TimerBar";
import { DIALOG_TIMER_BAR_STYLE } from "./timerBarStyles";

export function attachDialogTimerBar(
  scene: Phaser.Scene,
  dialog: Phaser.GameObjects.Container,
  layout: DialogLayout,
) {
  const width = Math.max(120, layout.dialogWidth - layout.margin * 2);
  const bar = new TimerBar(scene, {
    width,
    ...DIALOG_TIMER_BAR_STYLE,
  });
  const x = -layout.dialogWidth / 2 + layout.margin;
  const y = -layout.dialogHeight / 2 + layout.headerOffset + 20;
  bar.setPosition(x, y);
  bar.addTo(dialog);
  return bar;
}
