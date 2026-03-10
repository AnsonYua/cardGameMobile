import Phaser from "phaser";
import type { ApiManager } from "../api/ApiManager";
import type { GameEngine } from "../game/GameEngine";
import type { GameContextStore } from "../game/GameContextStore";
import { findLatestUnresolvedChoiceOwner } from "./choice/ChoiceOwnerResolver";
import { createLogger } from "../utils/logger";

type AiStepControllerDeps = {
  scene: Phaser.Scene;
  api: ApiManager;
  engine: GameEngine;
  contextStore: GameContextStore;
  isAnimationQueueRunning: () => boolean;
};

export class AiStepController {
  private readonly log = createLogger("AiStepController");
  private retryEvent?: Phaser.Time.TimerEvent;
  private inFlight = false;

  constructor(private readonly deps: AiStepControllerDeps) {}

  destroy() {
    this.clearRetry();
    this.inFlight = false;
  }

  handleAnimationQueueIdle() {
    this.syncFromLatestSnapshot("animation_idle");
  }

  handleSnapshotUpdated() {
    this.syncFromLatestSnapshot("snapshot_updated", { allowSetupBootstrap: true });
  }

  private syncFromLatestSnapshot(source: string, opts: { allowSetupBootstrap?: boolean } = {}) {
    const raw = this.deps.engine.getSnapshot().raw as any;
    if (!this.shouldDriveAi(raw)) {
      this.clearRetry();
      return;
    }
    if (this.inFlight) {
      return;
    }

    const isSetupLike = this.isSetupLike(raw);
    if (opts.allowSetupBootstrap && !isSetupLike) {
      return;
    }
    if (this.deps.isAnimationQueueRunning() && !(opts.allowSetupBootstrap && isSetupLike)) {
      return;
    }
    if (!opts.allowSetupBootstrap && isSetupLike) {
      return;
    }

    const retryAfterMs = this.getRetryAfterMs(raw);
    if (retryAfterMs > 0) {
      this.scheduleRetry(retryAfterMs, source);
      return;
    }

    void this.advanceOneStep(source);
  }

  private shouldDriveAi(raw: any): boolean {
    const ctx = this.deps.contextStore.get();
    if (!ctx.isAutoPolling || !ctx.isAiMatch) return false;
    if (!ctx.gameId || !ctx.playerId) return false;
    if (!raw) return false;
    if (this.hasBlockingSelfPrompt(raw, ctx.playerId)) return false;

    const hasMoreAiWork = raw?.aiAutoplay?.hasMoreAiWork === true || raw?.hasMoreAiWork === true;
    return hasMoreAiWork;
  }

  private hasBlockingSelfPrompt(raw: any, playerId: string): boolean {
    const unresolved = findLatestUnresolvedChoiceOwner(raw);
    return Boolean(unresolved?.ownerPlayerId && unresolved.ownerPlayerId === playerId);
  }

  private getRetryAfterMs(raw: any): number {
    const value = Number(raw?.retryAfterMs ?? raw?.aiAutoplay?.throttleWaitMs ?? 0);
    if (!Number.isFinite(value) || value <= 0) return 0;
    return Math.max(50, Math.round(value));
  }

  private isSetupLike(raw: any): boolean {
    const phase = raw?.gameEnv?.phase ?? raw?.phase;
    return phase === "DECIDE_FIRST_PLAYER_PHASE" || phase === "REDRAW_PHASE";
  }

  private scheduleRetry(delayMs: number, source: string) {
    if (this.retryEvent) {
      const existingDelay = Number(this.retryEvent.delay ?? 0);
      if (Math.abs(existingDelay - delayMs) <= 25) {
        return;
      }
      this.clearRetry();
    }

    this.log.debug("schedule retry", { delayMs, source });
    this.retryEvent = this.deps.scene.time.addEvent({
      delay: delayMs,
      callback: () => {
        this.retryEvent = undefined;
        this.syncFromLatestSnapshot("retry_timer");
      },
    });
  }

  private clearRetry() {
    this.retryEvent?.remove();
    this.retryEvent = undefined;
  }

  private async advanceOneStep(source: string) {
    const ctx = this.deps.contextStore.get();
    const raw = this.deps.engine.getSnapshot().raw as any;
    if (!this.shouldDriveAi(raw) || !ctx.gameId || !ctx.playerId) {
      this.clearRetry();
      return;
    }
    if (this.inFlight || this.deps.isAnimationQueueRunning()) {
      return;
    }

    this.clearRetry();
    this.inFlight = true;
    this.log.debug("advance ai step", { source, gameId: ctx.gameId, playerId: ctx.playerId });
    try {
      const response = await this.deps.api.advanceAiStep({
        gameId: ctx.gameId,
        playerId: ctx.playerId,
      });
      await this.deps.engine.updateGameStatus(ctx.gameId, ctx.playerId, {
        statusPayload: response,
        silent: false,
      });
    } catch (err) {
      this.log.warn("advance ai step failed", {
        source,
        message: err instanceof Error ? err.message : String(err),
      });
      const latestRaw = this.deps.engine.getSnapshot().raw as any;
      if (this.shouldDriveAi(latestRaw)) {
        this.scheduleRetry(Math.max(this.getRetryAfterMs(latestRaw), 1000), "advance_error");
      }
    } finally {
      this.inFlight = false;
    }
  }
}
