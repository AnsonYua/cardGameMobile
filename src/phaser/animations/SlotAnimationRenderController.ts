import type { AnimationContext } from "./AnimationTypes";
import type { SlotViewModel } from "../ui/SlotTypes";
import type { SlotNotification } from "./NotificationAnimationController";
import { extractCardUidsFromNotification } from "./NotificationCardUids";

export class SlotAnimationRenderController {
  // Snapshot of slot visuals used during animations; null means the slot is empty.
  private renderSnapshots = new Map<string, SlotViewModel | null>();
  // Slots currently animating; hidden from render while running.
  private runningSlots = new Set<string>();
  // Map of event id -> affected slot keys.
  private eventSlots = new Map<string, string[]>();

  constructor(private getSlotsFromRaw: (raw: any) => SlotViewModel[]) {}

  startBatch(
    events: SlotNotification[],
    previousSlots: SlotViewModel[],
    currentSlots: SlotViewModel[],
  ): SlotViewModel[] {
    this.initRenderSnapshots(events, previousSlots, currentSlots);
    return this.buildSlotsForRender(currentSlots);
  }

  handleEventStart(event: SlotNotification, currentSlots: SlotViewModel[]): SlotViewModel[] {
    const keys = this.eventSlots.get(event.id) ?? [];
    // Default: hide affected slots while this event animates.
    // TODO: override per event type when needed (some events may not hide).
    
    //dont need to hide the target or attacker when UNIT_ATTACK_DECLARED
    if(event.type != "UNIT_ATTACK_DECLARED"){
      keys.forEach((key) => this.runningSlots.add(key));
    }
    return this.buildSlotsForRender(currentSlots);
  }

  handleEventEnd(event: SlotNotification, ctx: AnimationContext): SlotViewModel[] | null {
    const keys = this.eventSlots.get(event.id) ?? [];
    const raw = ctx.currentRaw ?? ctx.previousRaw;
    if (!raw) return null;
    const currentSlots = this.getSlotsFromRaw(raw);
    const byKey = new Map(currentSlots.map((slot) => [`${slot.owner}-${slot.slotId}`, slot]));
    // Default: copy current slot state into the snapshot when the event finishes.
    // TODO: override per event type when we need custom slot label updates.
    keys.forEach((key) => {
      this.runningSlots.delete(key);
      const slot = byKey.get(key);
      this.renderSnapshots.set(key, slot ? this.cloneSlot(slot) : null);
    });
    return this.buildSlotsForRender(currentSlots);
  }

  clear() {
    this.renderSnapshots.clear();
    this.runningSlots.clear();
    this.eventSlots.clear();
  }

  private initRenderSnapshots(
    events: SlotNotification[],
    previousSlots: SlotViewModel[],
    currentSlots: SlotViewModel[],
  ) {
    this.renderSnapshots.clear();
    this.runningSlots.clear();
    this.eventSlots.clear();

    const slotKey = (slot: SlotViewModel) => `${slot.owner}-${slot.slotId}`;
    const byUid = new Map<string, SlotViewModel>();
    previousSlots.forEach((slot) => {
      if (slot.unit?.cardUid) byUid.set(slot.unit.cardUid, slot);
      if (slot.pilot?.cardUid) byUid.set(slot.pilot.cardUid, slot);
    });
    currentSlots.forEach((slot) => {
      if (slot.unit?.cardUid && !byUid.has(slot.unit.cardUid)) byUid.set(slot.unit.cardUid, slot);
      if (slot.pilot?.cardUid && !byUid.has(slot.pilot.cardUid)) byUid.set(slot.pilot.cardUid, slot);
    });

    events.forEach((event) => {
      const keys = new Set<string>();
      extractCardUidsFromNotification(event).forEach((uid) => {
        const slot = byUid.get(uid);
        if (!slot) return;
        const key = slotKey(slot);
        keys.add(key);
        if (!this.renderSnapshots.has(key)) {
          this.renderSnapshots.set(key, this.cloneSlot(slot));
        }
      });
      this.eventSlots.set(event.id, Array.from(keys));
    });
  }

  private buildSlotsForRender(currentSlots: SlotViewModel[]) {
    const result: SlotViewModel[] = [];
    const renderedKeys = new Set<string>();
    const toKey = (slot: SlotViewModel) => `${slot.owner}-${slot.slotId}`;
    const isHidden = (key: string, snapshot: SlotViewModel | null | undefined) =>
      this.runningSlots.has(key) || snapshot === null;

    // Render current slots first, overridden by snapshots when present.
    currentSlots.forEach((slot) => {
      const key = toKey(slot);
      const snapshot = this.renderSnapshots.get(key);
      if (isHidden(key, snapshot)) return;
      result.push(snapshot ?? slot);
      renderedKeys.add(key);
    });

    // Add snapshot-only slots that don't exist in current slots.
    this.renderSnapshots.forEach((snapshot, key) => {
      if (renderedKeys.has(key)) return;
      if (isHidden(key, snapshot)) return;
      if (!snapshot) return;
      result.push(snapshot);
    });

    return result;
  }

  private cloneSlot(slot: SlotViewModel): SlotViewModel {
    return {
      ...slot,
      unit: slot.unit ? { ...slot.unit } : undefined,
      pilot: slot.pilot ? { ...slot.pilot } : undefined,
    };
  }
}
