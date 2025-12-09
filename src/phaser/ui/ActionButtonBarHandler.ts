import Phaser from "phaser";
import { BASE_H, INTERNAL_W } from "../../config/gameLayout";
import { DrawHelpers } from "./HeaderHandler";
import { Palette } from "./types";

type ActionButtonConfig = {
  label: string;
  onClick?: () => void;
  enabled?: boolean;
};

export class ActionButtonBarHandler {
  private barHeight = 40;
  private barPadding = 16;
  private barWidth = INTERNAL_W - this.barPadding * 2;
  private buttons: string[] = [];
  private pinnedButtons: ActionButtonConfig[] = [
    { label: "Play Card", onClick: () => {} },
    { label: "Trigger Effect", onClick: () => {} },
  ];
  private endTurnButton: ActionButtonConfig = { label: "End Turn", onClick: () => {} };
  private hitAreas: Phaser.GameObjects.Rectangle[] = [];
  private elements: Phaser.GameObjects.GameObject[] = [];
  private onAction: (index: number) => void = () => {};
  private lastOffset: { x: number; y: number } = { x: 0, y: 0 };
  private barBounds = { left: 0, right: 0, top: 0, bottom: 0 };

  // Mirrors HandAreaHandler layout so the bar can sit just above the hand.
  private handLayout = { cardH: 90, gap: 5, rows: 2, bottomPadding: 24 };
  private buttonStyle = {
    outerColor: 0x2f6ad9,
    outerStroke: 0x1f4f9c,
    innerColor: 0xf2f5ff,
    innerStroke: 0xffffff,
    textColor: "#1f3f9c",
    endOuterColor: 0x1e7bff,
  };

  constructor(private scene: Phaser.Scene, private palette: Palette, private drawHelpers: DrawHelpers) {}

  setActionHandler(handler: (index: number) => void) {
    this.onAction = handler;
  }

  setButtons(labels: string[]) {
    this.buttons = [...labels];
    this.draw(this.lastOffset);
  }

  setPinnedButtons(buttons: ActionButtonConfig[]) {
    const next: ActionButtonConfig[] = [
      buttons[0] ?? this.pinnedButtons[0],
      buttons[1] ?? this.pinnedButtons[1],
    ];
    this.pinnedButtons = next.map((b, idx) => ({
      label: b?.label ?? `Action ${idx + 1}`,
      onClick: b?.onClick ?? (() => {}),
      enabled: b?.enabled ?? true,
    }));
    this.draw(this.lastOffset);
  }

  setEndTurnButton(button: ActionButtonConfig) {
    this.endTurnButton = {
      label: button?.label ?? this.endTurnButton.label,
      onClick: button?.onClick ?? this.endTurnButton.onClick,
      enabled: button?.enabled ?? true,
    };
    this.draw(this.lastOffset);
  }

  setVisible(visible: boolean) {
    this.elements.forEach((e) => (e as any).setVisible?.(visible));
    this.hitAreas.forEach((h) => {
      h.setVisible(visible);
      if (visible) {
        h.setInteractive({ useHandCursor: true });
      } else {
        h.disableInteractive();
      }
    });
  }

  fadeIn(duration = 200) {
    this.setVisible(true);
    const tweenTargets = this.elements.filter((e) => typeof (e as any).setAlpha === "function");
    tweenTargets.forEach((t) => (t as any).setAlpha?.(0));
    if (tweenTargets.length) {
      this.scene.tweens.add({ targets: tweenTargets as any, alpha: 1, duration, ease: "Sine.easeOut" });
    }
  }

  draw(offset: { x: number; y: number }) {
    this.lastOffset = offset;
    this.elements.forEach((e) => e.destroy());
    this.elements = [];
    this.hitAreas.forEach((h) => h.destroy());
    this.hitAreas = [];

    // Geometry and positioning.
    const { cardH, gap, rows, bottomPadding } = this.handLayout;
    const totalHandHeight = rows * cardH + (rows - 1) * gap;
    const handTop = BASE_H - bottomPadding - totalHandHeight + offset.y;
    const barY = handTop - this.barHeight / 2 - 12;
    const barX = INTERNAL_W / 2;
    const btnGap = 12;
    const btnWidth = 120;
    const btnHeight = this.barHeight;

    this.barBounds = {
      left: 0,
      right: INTERNAL_W,
      top: barY - btnHeight / 2,
      bottom: barY + btnHeight / 2,
    };

    // Always draw the background bar.
    const bg = this.drawHelpers
      .drawRoundedRectOrigin({
        x: 0,
        y: barY - 23,
        width: INTERNAL_W,
        height: 300,
        radius: 0,
        fillColor: "#414242",
        fillAlpha: 1,
        strokeColor: 0x5e48f0,
        strokeAlpha: 0,
        strokeWidth: 0,
      })
      .setDepth(0);
    this.elements.push(bg);

    // Layout exactly three buttons spanning the internal width: pinned[0], pinned[1], end turn.
    const slots = 3;
    const btnSpan = (this.barWidth - btnGap * (slots - 1)) / slots;
    const leftStart = barX - this.barWidth / 2 + btnSpan / 2;

    // Left pinned
    this.drawButton(
      leftStart,
      barY,
      btnSpan,
      btnHeight,
      this.pinnedButtons[0] || { label: "Action 1" },
      900,
      0x5e48f0,
      null,
    );
    // Middle pinned
    this.drawButton(
      leftStart + (btnSpan + btnGap),
      barY,
      btnSpan,
      btnHeight,
      this.pinnedButtons[1] || { label: "Action 2" },
      900,
      0x5e48f0,
      null,
    );
    // End turn on the right
    this.drawButton(
      leftStart + 2 * (btnSpan + btnGap),
      barY,
      btnSpan,
      btnHeight,
      this.endTurnButton,
      900,
      this.buttonStyle.endOuterColor,
      null,
    );
  }

  private drawButton(
    x: number,
    y: number,
    w: number,
    h: number,
    config: ActionButtonConfig,
    depth: number,
    fillColor: number,
    actionIndex: number | null,
  ) {
    const enabled = config.enabled !== false;
    // Outer pill
    const outer = this.drawHelpers
      .drawRoundedRect({
        x,
        y,
        width: w,
        height: h,
        radius: h / 2,
        fillColor,
        fillAlpha: enabled ? 1 : 0.4,
        strokeColor: this.buttonStyle.outerStroke,
        strokeAlpha: 0.8,
        strokeWidth: 2,
      })
      .setDepth(depth);
    this.elements.push(outer);

    // Inner pill inset
    const inner = this.drawHelpers
      .drawRoundedRect({
        x,
        y,
        width: w - 10,
        height: h - 12,
        radius: (h - 12) / 2,
        fillColor: this.buttonStyle.innerColor,
        fillAlpha: enabled ? 1 : 0.6,
        strokeColor: this.buttonStyle.innerStroke,
        strokeAlpha: 0.6,
        strokeWidth: 1,
      })
      .setDepth(depth + 1);
    this.elements.push(inner);

    const text = this.scene.add
      .text(x, y, config.label || "", {
        fontSize: "15px",
        fontFamily: "Arial",
        color: enabled ? this.buttonStyle.textColor : "#8a9abf",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(depth + 2);
    this.elements.push(text);

    const hit = this.scene.add
      .rectangle(x, y, w, h, 0x000000, 0)
      .setInteractive({ useHandCursor: enabled })
      .setDepth(depth + 3);
    hit.on("pointerup", () => {
      if (!enabled) return;
      if (actionIndex !== null) {
        this.onAction(actionIndex);
      }
      config.onClick?.();
    });
    this.hitAreas.push(hit);
    this.elements.push(hit);
  }
}
