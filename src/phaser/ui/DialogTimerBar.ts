import type Phaser from "phaser";
import type { DialogLayout } from "./CardDialogLayout";
import { TimerBar } from "./TimerBar";

export function attachDialogTimerBar(
  scene: Phaser.Scene,
  dialog: Phaser.GameObjects.Container,
  layout: DialogLayout,
) {
  const width = Math.max(120, layout.dialogWidth - layout.margin * 2);
  const bar = new TimerBar(scene, {
    width,
    height: 6,
    fillColor: 0x4b79ff,
    bgColor: 0x0f1118,
    borderColor: 0x5b6068,
    showLabel: false,
  });
  const x = -layout.dialogWidth / 2 + layout.margin;
  const y = -layout.dialogHeight / 2 + layout.headerOffset + 20;
  bar.setPosition(x, y);
  bar.addTo(dialog);
  return bar;
}
