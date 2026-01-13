import type Phaser from "phaser";
import { DIALOG_TIMER_SECONDS, TIMER_TICK_MS, TURN_TIMER_SECONDS } from "../../config/timerConfig";

export type TimerRenderer = {
  setProgress: (progress: number, secondsLeft: number) => void;
  setVisible: (visible: boolean) => void;
};

type TimerMode = "turn" | "dialog" | "idle";

export class TurnTimerController {
  private mode: TimerMode = "idle";
  private remainingMs = 0;
  private durationMs = 0;
  private timerEvent?: Phaser.Time.TimerEvent;
  private onExpire?: () => void;
  private headerRenderer?: TimerRenderer;
  private dialogRenderer?: TimerRenderer;
  private enabled = true;
  private turnExpireHandler?: () => void;
  private dialogTokenCounter = 0;
  private activeDialogToken?: number;

  constructor(private scene: Phaser.Scene) {}

  setHeaderRenderer(renderer: TimerRenderer) {
    this.headerRenderer = renderer;
  }

  setDialogRenderer(renderer?: TimerRenderer) {
    this.dialogRenderer = renderer;
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) {
      if (this.mode === "turn") {
        this.stop();
      } else {
        this.headerRenderer?.setVisible(false);
      }
      return;
    }
    if (this.mode === "idle") {
      this.startTurnTimer(this.turnExpireHandler);
    }
  }

  isDialogActive() {
    return this.mode === "dialog";
  }

  ensureTurnTimer(onExpire?: () => void) {
    this.turnExpireHandler = onExpire;
    if (this.mode === "turn") return;
    if (this.mode === "dialog") return;
    this.startTurnTimer(onExpire);
  }

  resumeTurnTimer() {
    if (!this.enabled) return;
    if (this.mode !== "idle") return;
    this.startTurnTimer(this.turnExpireHandler);
  }

  startTurnTimer(onExpire?: () => void) {
    if (!this.enabled) return;
    this.mode = "turn";
    this.durationMs = TURN_TIMER_SECONDS * 1000;
    this.remainingMs = this.durationMs;
    this.onExpire = onExpire;
    this.headerRenderer?.setVisible(true);
    this.dialogRenderer?.setVisible(false);
    this.startTicker();
    this.syncRenderers();
  }

  startDialogTimer(renderer: TimerRenderer, onExpire?: () => void) {
    const token = ++this.dialogTokenCounter;
    this.dialogRenderer = renderer;
    this.mode = "dialog";
    this.durationMs = DIALOG_TIMER_SECONDS * 1000;
    this.remainingMs = this.durationMs;
    this.onExpire = onExpire;
    this.activeDialogToken = token;
    this.headerRenderer?.setVisible(false);
    this.dialogRenderer?.setVisible(true);
    this.startTicker();
    this.syncRenderers();
    return token;
  }

  endDialogTimer(token?: number) {
    if (this.mode !== "dialog") return;
    if (token !== undefined && token !== this.activeDialogToken) return;
    if (token === undefined && this.activeDialogToken !== undefined) return;
    this.dialogRenderer?.setVisible(false);
    this.dialogRenderer = undefined;
    this.activeDialogToken = undefined;
    this.mode = "idle";
    this.stopTicker();
  }

  stop() {
    this.mode = "idle";
    this.remainingMs = 0;
    this.stopTicker();
    this.headerRenderer?.setVisible(false);
    this.dialogRenderer?.setVisible(false);
    this.activeDialogToken = undefined;
  }

  reset() {
    if (!this.enabled || this.mode === "idle") return;
    this.remainingMs = this.durationMs;
    this.syncRenderers();
  }

  private startTicker() {
    if (this.timerEvent) return;
    this.timerEvent = this.scene.time.addEvent({
      delay: TIMER_TICK_MS,
      loop: true,
      callback: () => this.tick(),
    });
  }

  private stopTicker() {
    this.timerEvent?.remove();
    this.timerEvent = undefined;
  }

  private tick() {
    if (this.mode === "idle") return;
    if (this.mode === "turn" && !this.enabled) return;
    this.remainingMs -= TIMER_TICK_MS;
    if (this.remainingMs <= 0) {
      this.remainingMs = 0;
      this.syncRenderers();
      const expire = this.onExpire;
      this.stop();
      expire?.();
      return;
    }
    this.syncRenderers();
  }

  private syncRenderers() {
    const secondsLeft = Math.max(0, Math.ceil(this.remainingMs / 1000));
    const progress = this.durationMs > 0 ? this.remainingMs / this.durationMs : 0;
    if (this.mode === "dialog") {
      this.dialogRenderer?.setProgress(progress, secondsLeft);
      return;
    }
    if (this.mode === "turn") {
      this.headerRenderer?.setProgress(progress, secondsLeft);
    }
  }
}
