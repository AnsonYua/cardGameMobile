import Phaser from "phaser";
import type { GameEngine } from "../game/GameEngine";
import type { GameContextStore } from "../game/GameContextStore";
import { createLogger } from "../utils/logger";

type MatchSyncControllerDeps = {
  scene: Phaser.Scene;
  engine: GameEngine;
  contextStore: GameContextStore;
  isAnimationQueueRunning: () => boolean;
  onRefreshComplete?: () => void;
};

export class MatchSyncController {
  private readonly log = createLogger("MatchSyncController");
  private pollEvent?: Phaser.Time.TimerEvent;
  private inFlight = false;
  private deferredPollPending = false;
  private readonly pollDelayMs = 1000;

  constructor(private readonly deps: MatchSyncControllerDeps) {}

  start() {
    if (this.pollEvent) return;
    if (!this.shouldPoll()) return;
    this.pollEvent = this.deps.scene.time.addEvent({
      delay: this.pollDelayMs,
      loop: true,
      callback: () => {
        void this.tick("interval");
      },
    });
  }

  stop() {
    this.pollEvent?.remove();
    this.pollEvent = undefined;
    this.deferredPollPending = false;
    this.inFlight = false;
  }

  destroy() {
    this.stop();
  }

  async flushDeferredPoll() {
    if (!this.deferredPollPending) return;
    this.deferredPollPending = false;
    await this.tick("deferred_flush");
  }

  private shouldPoll(): boolean {
    const ctx = this.deps.contextStore.get();
    return Boolean(ctx.isAutoPolling && ctx.gameId && ctx.playerId);
  }

  private async tick(source: string) {
    if (!this.shouldPoll()) {
      this.stop();
      return;
    }
    if (this.inFlight) return;
    if (this.deps.isAnimationQueueRunning()) {
      this.deferredPollPending = true;
      return;
    }

    const ctx = this.deps.contextStore.get();
    if (!ctx.gameId || !ctx.playerId) {
      return;
    }

    this.inFlight = true;
    try {
      await this.deps.engine.updateGameStatus(ctx.gameId, ctx.playerId);
      this.deps.onRefreshComplete?.();
    } catch (err) {
      this.log.warn("passive match sync failed", {
        source,
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      this.inFlight = false;
    }
  }
}
