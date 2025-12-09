import Phaser from "phaser";
import { BASE_H, INTERNAL_W } from "../../config/gameLayout";
import { DrawHelpers } from "./HeaderHandler";
import { Palette } from "./types";

type ActionButtonConfig = {
  label: string;
  onClick?: () => void;
  enabled?: boolean;
};
type ActionBarState = {
  pinned: [ActionButtonConfig, ActionButtonConfig];
  endTurn: ActionButtonConfig;
};

export class ActionButtonBarHandler {
  private barHeight = 40;
  private barPadding = 16;
  private barWidth = INTERNAL_W - this.barPadding * 2;
  private buttons: string[] = [];
  private state: ActionBarState = {
    pinned: [
      { label: "Play Card", onClick: () => {} },
      { label: "Trigger Effect", onClick: () => {} },
    ],
    endTurn: { label: "End Turn", onClick: () => {} },
  };
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
      buttons[0] ?? this.state.pinned[0],
      buttons[1] ?? this.state.pinned[1],
    ];
    const normalized = next.map((b, idx) => ({
      label: b?.label ?? `Action ${idx + 1}`,
      onClick: b?.onClick ?? (() => {}),
      enabled: b?.enabled ?? true,
    })) as [ActionButtonConfig, ActionButtonConfig];
    this.setState({ pinned: normalized });
  }

  setState(next: Partial<ActionBarState>) {
    this.state = {
      pinned: next.pinned ?? this.state.pinned,
      endTurn: next.endTurn ?? this.state.endTurn,
    };
    // Ensure pinned slots are always present.
    this.state.pinned = [
      this.state.pinned[0] ?? { label: "", enabled: false },
      this.state.pinned[1] ?? { label: "", enabled: false },
    ];
    this.draw(this.lastOffset);
  }

  setEndTurnButton(button: ActionButtonConfig) {
    this.state.endTurn = {
      label: button?.label ?? this.state.endTurn.label,
      onClick: button?.onClick ?? this.state.endTurn.onClick,
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
    const btnWidth = 120; // fixed size to keep buttons consistent
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

    // Build buttons to render (hide pinned if blank/disabled).
    const renderButtons: Array<{ config: ActionButtonConfig; color: number; actionIndex: number | null }> = [];
    const pin1 = this.state.pinned[0];
    const pin2 = this.state.pinned[1];
    if (pin1 && pin1.label && pin1.label.trim() && pin1.enabled !== false) {
      renderButtons.push({ config: pin1, color: 0x5e48f0, actionIndex: null });
    }
    if (pin2 && pin2.label && pin2.label.trim() && pin2.enabled !== false) {
      renderButtons.push({ config: pin2, color: 0x5e48f0, actionIndex: null });
    }
    // End turn only if it has a label and is enabled.
    if (
      this.state.endTurn &&
      this.state.endTurn.label &&
      this.state.endTurn.label.trim() &&
      this.state.endTurn.enabled !== false
    ) {
      renderButtons.push({ config: this.state.endTurn, color: this.buttonStyle.endOuterColor, actionIndex: null });
    }

    const count = renderButtons.length;
    const totalWidth = count * btnWidth + (count - 1) * btnGap;
    const leftStart = barX - totalWidth / 2 + btnWidth / 2;

    renderButtons.forEach((btn, idx) => {
      const x = leftStart + idx * (btnWidth + btnGap);
      this.drawButton(x, barY, btnWidth, btnHeight, btn.config, 900, btn.color, btn.actionIndex);
    });
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
