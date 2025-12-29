import type { AnimationContext, AnimationEvent } from "./AnimationTypes";
import type { AnimationExecutor } from "./AnimationExecutor";

type QueueItem = {
  event: AnimationEvent;
  ctx: AnimationContext;
};

export class AnimationQueue {
  private queue: QueueItem[] = [];
  private running = false;
  private processedIds = new Set<string>();
  private processedOrder: string[] = [];
  private onIdle?: () => void;

  constructor(
    private executor: AnimationExecutor,
    private opts: {
      maxProcessed?: number;
    } = {},
  ) {}

  setOnIdle(handler?: () => void) {
    this.onIdle = handler;
  }

  isRunning() {
    return this.running;
  }

  enqueue(events: AnimationEvent[], ctx: AnimationContext) {
    events.forEach((event) => {
      if (!event.id) return;
      if (this.processedIds.has(event.id)) return;
      this.markProcessed(event.id);
      this.queue.push({ event, ctx });
    });
    this.runIfIdle();
  }

  private runIfIdle() {
    if (this.running) return;
    if (this.queue.length === 0) {
      this.onIdle?.();
      return;
    }
    this.running = true;
    this.runNext();
  }

  private async runNext() {
    const item = this.queue.shift();
    if (!item) {
      this.running = false;
      this.onIdle?.();
      return;
    }
    try {
      await this.executor.run(item.event, item.ctx);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[AnimationQueue] event failed", item.event.type, item.event.id, err);
    } finally {
      this.runNext();
    }
  }

  private markProcessed(id: string) {
    this.processedIds.add(id);
    this.processedOrder.push(id);
    const max = this.opts.maxProcessed ?? 1000;
    while (this.processedOrder.length > max) {
      const oldest = this.processedOrder.shift();
      if (oldest) {
        this.processedIds.delete(oldest);
      }
    }
  }
}
