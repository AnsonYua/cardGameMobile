import type { AnimationContext, AnimationEvent } from "./AnimationTypes";
import type { SlotViewModel } from "../ui/SlotTypes";

export class SlotAnimationRenderState {
  private slotSnapshots = new Map<string, SlotViewModel | null>();
  private runningSlots = new Set<string>();
  private eventSlots = new Map<string, string[]>();
  private currentSlots: SlotViewModel[];

  constructor(
    events: AnimationEvent[],
    previousSlots: SlotViewModel[],
    currentSlots: SlotViewModel[],
    private getSlotsFromRaw: (raw: any) => SlotViewModel[],
  ) {
    this.currentSlots = currentSlots;
    this.buildState(events, previousSlots, currentSlots);
  }

  buildSlotsForRender(slots: SlotViewModel[] = this.currentSlots) {
    const rendered: SlotViewModel[] = [];
    const seen = new Set<string>();
    const slotKey = (slot: SlotViewModel) => `${slot.owner}-${slot.slotId}`;

    slots.forEach((slot) => {
      const key = slotKey(slot);
      if (this.runningSlots.has(key)) return;
      const snapshot = this.slotSnapshots.get(key);
      if (snapshot === null) return;
      rendered.push(snapshot ?? slot);
      seen.add(key);
    });

    this.slotSnapshots.forEach((snapshot, key) => {
      if (seen.has(key)) return;
      if (this.runningSlots.has(key)) return;
      if (!snapshot) return;
      rendered.push(snapshot);
    });

    return rendered;
  }

  handleEventStart(event: AnimationEvent, _ctx?: AnimationContext) {
    const keys = this.eventSlots.get(event.id) ?? [];
    keys.forEach((key) => this.runningSlots.add(key));
    return this.buildSlotsForRender(this.currentSlots);
  }

  handleEventEnd(event: AnimationEvent, ctx: AnimationContext) {
    const keys = this.eventSlots.get(event.id) ?? [];
    const raw = ctx.currentRaw ?? ctx.previousRaw;
    if (!raw) return null;
    const currentSlots = this.getSlotsFromRaw(raw);
    const byKey = new Map(currentSlots.map((slot) => [`${slot.owner}-${slot.slotId}`, slot]));
    keys.forEach((key) => {
      this.runningSlots.delete(key);
      const slot = byKey.get(key);
      this.slotSnapshots.set(key, slot ? this.cloneSlot(slot) : null);
    });
    this.currentSlots = currentSlots;
    return this.buildSlotsForRender(currentSlots);
  }

  clear() {
    this.slotSnapshots.clear();
    this.runningSlots.clear();
    this.eventSlots.clear();
  }

  private buildState(
    events: AnimationEvent[],
    previousSlots: SlotViewModel[],
    currentSlots: SlotViewModel[],
  ) {
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
      event.cardUids.forEach((uid) => {
        const slot = byUid.get(uid);
        if (!slot) return;
        const key = slotKey(slot);
        keys.add(key);
        if (!this.slotSnapshots.has(key)) {
          this.slotSnapshots.set(key, this.cloneSlot(slot));
        }
      });
      this.eventSlots.set(event.id, Array.from(keys));
    });
  }

  private cloneSlot(slot: SlotViewModel): SlotViewModel {
    return {
      ...slot,
      unit: slot.unit ? { ...slot.unit } : undefined,
      pilot: slot.pilot ? { ...slot.pilot } : undefined,
    };
  }
}
