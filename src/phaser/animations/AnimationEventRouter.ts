import type { AnimationEvent, AnimationEventType } from "./AnimationTypes";
import type { SlotNotification } from "./NotificationAnimationController";

const SUPPORTED_TYPES: AnimationEventType[] = [
  "CARD_PLAYED",
  "UNIT_ATTACK_DECLARED",
  "BATTLE_RESOLVED",
  "CARD_STAT_MODIFIED",
];

export class AnimationEventRouter {
  private processedIds = new Set<string>();
  private processedOrder: string[] = [];

  buildEvents(notificationQueue: SlotNotification[]): AnimationEvent[] {
    if (!Array.isArray(notificationQueue) || notificationQueue.length === 0) {
      return [];
    }
    const events: AnimationEvent[] = [];
    notificationQueue.forEach((note) => {
      if (!note || !note.id) return;
      if (this.processedIds.has(note.id)) return;
      const type = (note.type || "").toUpperCase() as AnimationEventType;
      if (!SUPPORTED_TYPES.includes(type)) return;
      events.push({
        id: note.id,
        type,
        note,
        cardUids: this.extractCardUids(note),
      });
      this.markProcessed(note.id);
    });
    return events;
  }

  private markProcessed(id: string) {
    this.processedIds.add(id);
    this.processedOrder.push(id);
    const max = 1000;
    while (this.processedOrder.length > max) {
      const oldest = this.processedOrder.shift();
      if (oldest) {
        this.processedIds.delete(oldest);
      }
    }
  }

  hasBattleEvents(events: AnimationEvent[]): boolean {
    return events.some(
      (event) =>
        (event.type === "UNIT_ATTACK_DECLARED" || event.type === "BATTLE_RESOLVED") &&
        event.cardUids.length > 0,
    );
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
}
