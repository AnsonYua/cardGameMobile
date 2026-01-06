import Phaser from "phaser";
import { BASE_H, HAND_AREA_HEIGHT, INTERNAL_W } from "../../config/gameLayout";
import { UI_LAYOUT } from "./UiLayoutConfig";
import { toColor } from "./types";

type ActionButtonConfig = {
  label: string;
  onClick?: () => void;
  enabled?: boolean;
  primary?: boolean;
};
type ActionBarState = {
  descriptors: ActionButtonConfig[];
};

export class ActionButtonBarHandler {
  private barHeight = 40;
  private state: ActionBarState = {
    descriptors: [],
  };
  private hitAreas: Phaser.GameObjects.Rectangle[] = [];
  private elements: Phaser.GameObjects.GameObject[] = [];
  private onAction: (index: number) => void = () => {};
  private lastOffset: { x: number; y: number } = { x: 0, y: 0 };
  private waitingLabel?: Phaser.GameObjects.Text;
  private waitingTween?: Phaser.Tweens.Tween;
  private waitingMode = false;
  private waitingOverride: ActionButtonConfig[] | null = null;
  private waitingOverrideKey = "";

  // Mirrors HandAreaHandler layout so the bar can sit just above the hand.
  private handLayout = {
    cardH: HAND_AREA_HEIGHT - UI_LAYOUT.hand.bar.cardHOffset,
    gap: UI_LAYOUT.hand.bar.gap,
    rows: UI_LAYOUT.hand.bar.rows,
    bottomPadding: UI_LAYOUT.hand.bar.bottomPadding,
  };
  private buttonStyle = {
    outerColor: 0x2f6ad9,
    outerStroke: 0x1f4f9c,
    innerColor: 0xf2f5ff,
    innerStroke: 0xffffff,
    textColor: "#1f3f9c",
    endOuterColor: 0x1e7bff,
  };
  private buttonTextStyle = {
    fontSize: "15px",
    fontFamily: "Arial",
    fontStyle: "bold" as const,
  };

  constructor(private scene: Phaser.Scene) {}

  setActionHandler(handler: (index: number) => void) {
    this.onAction = handler;
  }

  setButtons(labels: string[]) {
    void labels;
    this.draw(this.lastOffset);
  }

  setPinnedButtons(buttons: ActionButtonConfig[]) {
    this.setDescriptors(buttons);
  }

  setState(next: Partial<ActionBarState>) {
    this.state = {
      descriptors: next.descriptors ?? this.state.descriptors,
    };
    // eslint-disable-next-line no-console
    console.log("[ActionBar] setState", { count: this.state.descriptors.length });
    this.draw(this.lastOffset);
  }

  setDescriptors(buttons: ActionButtonConfig[]) {
    const normalized = buttons.map((b, idx) => ({
      label: String(b?.label ?? `Action ${idx + 1}`),
      onClick: b?.onClick ?? (() => {}),
      enabled: b?.enabled ?? true,
      primary: (b as any)?.primary ?? false,
    }));
    this.setState({ descriptors: normalized });
  }

  setWaitingForOpponent(waiting: boolean, overrideButtons?: ActionButtonConfig[]) {
    const nextOverride = overrideButtons?.length ? overrideButtons : null;
    const nextOverrideKey = nextOverride
      ? nextOverride
          .map((btn) => `${String(btn?.label ?? "")}:${btn?.enabled ?? true}:${(btn as any)?.primary ?? false}`)
          .join("|")
      : "";
    if (this.waitingMode === waiting && this.waitingOverrideKey === nextOverrideKey) {
      return;
    }
    this.waitingMode = waiting;
    this.waitingOverride = nextOverride;
    this.waitingOverrideKey = nextOverrideKey;
    // eslint-disable-next-line no-console
    console.log("[ActionBar] waiting", { waiting, overrideCount: this.waitingOverride?.length ?? 0 });
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
    const totalHandHeight = rows * cardH + (rows - 1) * gap ;
    const handTop = BASE_H - bottomPadding - totalHandHeight + offset.y;
    const barY = handTop - this.barHeight / 2 - 3 ;
    const camW = this.scene.scale.width;
    const barX = camW / 2;
    const btnGap = 12;
    const btnHeight = this.barHeight;
    const bgHeight = HAND_AREA_HEIGHT + 120;

    // Always draw the background bar.
    const bg = this.drawRoundedRectOrigin({
      x: 0,
      y: barY - 25,
      width: camW,
      height: bgHeight,
      radius: 0,
      fillColor: "#414242",
      fillAlpha: 1,
      strokeColor: 0x5e48f0,
      strokeAlpha: 0,
      strokeWidth: 0,
    }).setDepth(0);
    this.elements.push(bg);
    this.waitingLabel?.destroy();
    this.waitingTween?.remove();
    if (this.waitingMode && !this.waitingOverride) {
      this.drawWaitingLabel(barY);
      return;
    }

    // Build buttons to render (hide pinned if blank/disabled).
    const renderButtons: Array<{ config: ActionButtonConfig; color: number; actionIndex: number | null }> = [];
    const sourceDescriptors = this.waitingOverride ?? this.state.descriptors;
    sourceDescriptors.forEach((btn) => {
      if (!btn.label || !btn.label.trim() || btn.enabled === false) return;
      const color = btn.primary ? this.buttonStyle.endOuterColor : 0x5e48f0;
      renderButtons.push({ config: btn, color, actionIndex: null });
    });

    if (!renderButtons.length) {
      // eslint-disable-next-line no-console
      console.warn("[ActionBar] no renderable buttons", {
        waitingMode: this.waitingMode,
        descriptors: sourceDescriptors.map((btn) => ({
          label: btn.label,
          enabled: btn.enabled,
          primary: btn.primary,
        })),
      });
      return;
    }

    const buttonsWithSize = renderButtons.map((btn) => {
      const temp = this.scene.add
        .text(0, 0, btn.config.label || "", this.buttonTextStyle)
        .setOrigin(0.5)
        .setVisible(false);
      const width = Math.max(110, temp.width + 32);
      temp.destroy();
      return { ...btn, width };
    });

    const totalButtonsWidth = buttonsWithSize.reduce((sum, btn) => sum + btn.width, 0);
    const totalWidth = totalButtonsWidth + btnGap * (buttonsWithSize.length - 1);
    let currentX = barX - totalWidth / 2;

    buttonsWithSize.forEach((btn) => {
      const x = currentX + btn.width / 2;
      this.drawButton(x, barY, btn.width, btnHeight, btn.config, 900, btn.color, btn.actionIndex);
      currentX += btn.width + btnGap;
    });
  }

  private drawRoundedRect(config: {
    x: number;
    y: number;
    width: number;
    height: number;
    radius: number;
    fillColor: number | string;
    fillAlpha?: number;
    strokeColor?: number | string;
    strokeAlpha?: number;
    strokeWidth?: number;
  }) {
    const {
      x,
      y,
      width,
      height,
      radius,
      fillColor,
      fillAlpha = 1,
      strokeColor,
      strokeAlpha = 1,
      strokeWidth = 0,
    } = config;
    const g = this.scene.add.graphics({ x: x - width / 2, y: y - height / 2 });
    g.fillStyle(toColor(fillColor), fillAlpha);
    g.fillRoundedRect(0, 0, width, height, radius);
    if (strokeWidth > 0 && strokeColor !== undefined) {
      g.lineStyle(strokeWidth, toColor(strokeColor), strokeAlpha);
      g.strokeRoundedRect(0, 0, width, height, radius);
    }
    return g;
  }

  private drawRoundedRectOrigin(config: {
    x: number;
    y: number;
    width: number;
    height: number;
    radius: number;
    fillColor: number | string;
    fillAlpha?: number;
    strokeColor?: number | string;
    strokeAlpha?: number;
    strokeWidth?: number;
  }) {
    const {
      x,
      y,
      width,
      height,
      radius,
      fillColor,
      fillAlpha = 1,
      strokeColor,
      strokeAlpha = 1,
      strokeWidth = 0,
    } = config;
    const g = this.scene.add.graphics({ x, y });
    g.fillStyle(toColor(fillColor), fillAlpha);
    g.fillRoundedRect(0, 0, width, height, radius);
    if (strokeWidth > 0 && strokeColor !== undefined) {
      g.lineStyle(strokeWidth, toColor(strokeColor), strokeAlpha);
      g.strokeRoundedRect(0, 0, width, height, radius);
    }
    return g;
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
    const outer = this.drawRoundedRect({
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
    }).setDepth(depth);
    this.elements.push(outer);

    // Inner pill inset
    const inner = this.drawRoundedRect({
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
    }).setDepth(depth + 1);
    this.elements.push(inner);

    const textStyle = {
      ...this.buttonTextStyle,
      color: enabled ? this.buttonStyle.textColor : "#8a9abf",
    };
    const text = this.scene
      .add.text(x, y, String(config.label || ""), textStyle)
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

  private drawWaitingLabel(y: number) {
    this.waitingLabel?.destroy();
    this.waitingLabel = this.scene
      .add
      .text(INTERNAL_W / 2, y, "Waiting for opponent...", {
        fontSize: "16px",
        fontFamily: "Arial",
        color: "#ffffff",
      })
      .setOrigin(0.5)
      .setDepth(900);
    this.elements.push(this.waitingLabel);
    this.waitingTween?.remove();
    this.waitingTween = this.scene.tweens.add({
      targets: this.waitingLabel,
      alpha: 0.3,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }
}
