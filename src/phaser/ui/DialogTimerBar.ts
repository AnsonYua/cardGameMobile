import type Phaser from "phaser";
import type { DialogLayout } from "./CardDialogLayout";
import { TimerBar } from "./TimerBar";
import { DIALOG_TIMER_BAR_STYLE } from "./timerBarStyles";

export function attachDialogTimerBar(
  scene: Phaser.Scene,
  dialog: Phaser.GameObjects.Container,
  layout: DialogLayout,
) {
  const inset = 12;
  const width = Math.max(120, layout.dialogWidth - layout.margin * 2 - inset * 2);
  const bar = new TimerBar(scene, {
    width,
    ...DIALOG_TIMER_BAR_STYLE,
  });
  const x = -layout.dialogWidth / 2 + layout.margin + inset;
  const headerHeight = layout.headerHeight ?? 0;
  const headerGap = layout.headerGap ?? 14;
  const hasPromptLayout = headerHeight > 0;
  const headerBottom = -layout.dialogHeight / 2 + layout.headerOffset + headerHeight / 2;
  const y = hasPromptLayout ? headerBottom + headerGap / 2 : -layout.dialogHeight / 2 + layout.headerOffset + 24;
  bar.setPosition(x, y);
  bar.addTo(dialog);
  return bar;
}
