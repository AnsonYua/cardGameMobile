import type { AnimationContext, AnimationEvent, AnimationEventType } from "./AnimationTypes";
import type { SlotOwner, SlotViewModel } from "../ui/SlotTypes";
import type { SlotNotification } from "./NotificationAnimationController";
import type { NotificationAnimationController } from "./NotificationAnimationController";
import type { BattleAnimationManager } from "./BattleAnimationManager";
import type { AttackIndicatorController } from "../controllers/AttackIndicatorController";

type QueueItem = {
  event: AnimationEvent;
  ctx: AnimationContext;
};

const SUPPORTED_TYPES: AnimationEventType[] = [
  "CARD_PLAYED",
  "UNIT_ATTACK_DECLARED",
  "BATTLE_RESOLVED",
  "CARD_STAT_MODIFIED",
];

export class AnimationQueue {
  private queue: QueueItem[] = [];
  private running = false;
  private processedIds = new Set<string>();
  private processedOrder: string[] = [];
  private onIdle?: () => void;
  private onEventStart?: (event: AnimationEvent, ctx: AnimationContext) => void;
  private onEventEnd?: (event: AnimationEvent, ctx: AnimationContext) => void;

  constructor(
    private deps: {
      cardPlayAnimator: NotificationAnimationController;
      battleAnimator: BattleAnimationManager;
      attackIndicator: AttackIndicatorController;
      slotControls?: { playStatPulse?: (slotKey: string, delta: number) => Promise<void> | void } | null;
    },
    private opts: {
      maxProcessed?: number;
    } = {},
  ) {}

  setOnIdle(handler?: () => void) {
    this.onIdle = handler;
  }

  setOnEventStart(handler?: (event: AnimationEvent, ctx: AnimationContext) => void) {
    this.onEventStart = handler;
  }

  setOnEventEnd(handler?: (event: AnimationEvent, ctx: AnimationContext) => void) {
    this.onEventEnd = handler;
  }

  isRunning() {
    return this.running;
  }

  buildEvents(notificationQueue: SlotNotification[]): AnimationEvent[] {
    if (!Array.isArray(notificationQueue) || notificationQueue.length === 0) {
      return [];
    }
    const events: AnimationEvent[] = [];
    notificationQueue.forEach((note) => {
      if (!note || !note.id) return;
      const type = (note.type || "").toUpperCase() as AnimationEventType;
      if (!SUPPORTED_TYPES.includes(type)) return;
      events.push({
        id: note.id,
        type,
        note,
        cardUids: this.extractCardUids(note),
      });
    });
    return events;
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
    this.onEventStart?.(item.event, item.ctx);
    try {
      await this.runEvent(item.event, item.ctx);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[AnimationQueue] event failed", item.event.type, item.event.id, err);
    } finally {
      this.onEventEnd?.(item.event, item.ctx);
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

  private extractCardUids(note: SlotNotification): string[] {
    const payload = note.payload || {};
    const candidates = [
      payload.carduid,
      payload.cardUid,
      payload.attackerCarduid,
      payload.attackerUnitUid,
      payload.targetCarduid,
      payload.targetUnitUid,
      payload.forcedTargetCarduid,
      payload?.attacker?.carduid,
      payload?.attacker?.cardUid,
      payload?.target?.carduid,
      payload?.target?.cardUid,
    ];
    const uids = new Set<string>();
    candidates.forEach((value) => {
      if (typeof value === "string" && value.trim()) {
        uids.add(value);
      }
    });
    return Array.from(uids);
  }

  private async runEvent(event: AnimationEvent, ctx: AnimationContext): Promise<void> {
    if (!ctx.allowAnimations) return;
    console.log("sequence of animation " , event.type)
    switch (event.type) {
      case "CARD_PLAYED":
        await this.deps.cardPlayAnimator.playCardPlayed(event.note, {
          slots: ctx.slots,
          boardSlotPositions: ctx.boardSlotPositions,
          currentPlayerId: ctx.currentPlayerId,
          cardLookup: ctx.cardLookup,
          allowAnimations: ctx.allowAnimations,
        });
        return;
      case "UNIT_ATTACK_DECLARED":
        this.deps.attackIndicator.updateFromNotifications(
          ctx.notificationQueue,
          ctx.slots,
          ctx.boardSlotPositions ?? undefined,
          event.note,
        );
        this.deps.battleAnimator.captureAttackSnapshot(
          event.note,
          ctx.slots,
          ctx.boardSlotPositions ?? undefined,
        );
        return;
      case "BATTLE_RESOLVED":
        await this.deps.battleAnimator.playBattleResolution(event.note);
        this.deps.attackIndicator.updateFromNotifications(
          ctx.notificationQueue,
          ctx.slots,
          ctx.boardSlotPositions ?? undefined,
          undefined,
        );
        return;
      case "CARD_STAT_MODIFIED":
        await this.triggerStatPulse(event, ctx);
        return;
      default:
        return;
    }
  }

  private async triggerStatPulse(event: AnimationEvent, ctx: AnimationContext) {
    const payload = event.note.payload ?? {};
    const delta = this.normalizeDelta(payload);
    if (delta === 0) return;
    const slotKey = this.resolveSlotKey(payload, ctx.slots, ctx.resolveSlotOwnerByPlayer);
    if (!slotKey) return;
    const pulse = this.deps.slotControls?.playStatPulse;
    if (!pulse) return;
    await Promise.resolve(pulse(slotKey, delta));
  }

  private normalizeDelta(payload: any): number {
    const delta = payload?.delta ?? payload?.modifierValue;
    if (typeof delta === "number") return delta;
    const parsed = Number(delta);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private resolveSlotKey(
    payload: any,
    slots: SlotViewModel[],
    resolveOwner?: (playerId?: string) => SlotOwner | undefined,
  ): string | undefined {
    const owner = resolveOwner?.(payload?.playerId);
    const zone = typeof payload?.zone === "string" ? payload.zone : undefined;
    const slotId = zone || payload?.slotId || payload?.slot;
    if (owner && slotId) {
      return `${owner}-${slotId}`;
    }
    const cardUid = payload?.carduid ?? payload?.cardUid;
    if (cardUid) {
      const slot = slots.find(
        (entry) => entry.unit?.cardUid === cardUid || entry.pilot?.cardUid === cardUid,
      );
      if (slot) {
        return `${slot.owner}-${slot.slotId}`;
      }
    }
    return undefined;
  }
}
