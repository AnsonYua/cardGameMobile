import type { SlotNotification } from "./NotificationAnimationController";
import type { SlotOwner, SlotViewModel } from "../ui/SlotTypes";
import { ProcessedIdCache } from "./AnimationCaches";
import type { AnimationHandler, SlotAnimationContext } from "./AnimationOrchestrator";

export class StatChangeAnimationHandler implements AnimationHandler {
  private processedIds = new ProcessedIdCache(500);
  private animationQueue: Promise<void> = Promise.resolve();

  handle(ctx: SlotAnimationContext) {
    if (!ctx.allowAnimations) return this.animationQueue;
    const { notifications } = ctx;
    if (!Array.isArray(notifications) || notifications.length === 0) {
      return this.animationQueue;
    }
    notifications.forEach((note) => {
      if (!note || !note.id || this.processedIds.has(note.id)) return;
      const type = (note.type || "").toUpperCase();
      if (type !== "CARD_STAT_MODIFIED") return;
      const payload = note.payload ?? {};
      const delta = this.normalizeDelta(payload);
      const slotKey = this.resolveSlotKey(payload, ctx.slots, ctx.resolveSlotOwnerByPlayer);
      // eslint-disable-next-line no-console
      console.log("[StatChangeAnimation] resolve", {
        id: note.id,
        slotKey,
        delta,
        zone: payload?.zone,
        playerId: payload?.playerId,
        carduid: payload?.carduid ?? payload?.cardUid,
      });
      if (!slotKey || delta === 0) return;
      this.processedIds.add(note.id);
      this.enqueueAnimation(note.id, () => {
        if (!ctx.ui?.triggerStatPulse) {
          // eslint-disable-next-line no-console
          console.warn("[StatChangeAnimation] triggerStatPulse missing", note.id);
          return Promise.resolve();
        }
        // eslint-disable-next-line no-console
        console.log("[StatChangeAnimation] triggerStatPulse", slotKey, delta);
        return Promise.resolve(ctx.ui.triggerStatPulse(slotKey, delta)).then((result) => {
          // eslint-disable-next-line no-console
          console.log("[StatChangeAnimation] triggerStatPulse result", slotKey, result);
        });
      });
    });
    return this.animationQueue;
  }

  private enqueueAnimation(id: string, task: () => Promise<void>) {
    // Promise chaining guarantees FIFO ordering of stat animations.
    // eslint-disable-next-line no-console
    console.log("[StatChangeAnimation] enqueue", id, Date.now());
    this.animationQueue = this.animationQueue
      .then(async () => {
        // eslint-disable-next-line no-console
        console.log("[StatChangeAnimation] start", id, Date.now());
        await task();
        // eslint-disable-next-line no-console
        console.log("[StatChangeAnimation] complete", id, Date.now());
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.warn("[StatChangeAnimation] animation task failed", err);
      });
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
