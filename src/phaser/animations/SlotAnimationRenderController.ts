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

  private clampNonNegative(value: number) {
    return value < 0 ? 0 : value;
  }

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
    const type = (event.type || "").toUpperCase();
    if (type === "CARD_STAT_MODIFIED") {
      const stat = (event.payload?.stat ?? "").toString().toLowerCase();
      const displayValue = Number(event.payload?.displayValue);
      const hasDisplayValue = Number.isFinite(displayValue);
      const delta = Number(event.payload?.delta ?? event.payload?.modifierValue ?? 0);
      if (!hasDisplayValue && delta === 0) {
        return this.buildSlotsForRender(currentSlots);
      }
      keys.forEach((key) => {
        const base = this.renderSnapshots.get(key);
        if (!base) return;
        const snapshot = this.cloneSlot(base);
        const nextValue = hasDisplayValue ? displayValue : undefined;
        if (stat.includes("ap")) {
          const ap = nextValue ?? this.clampNonNegative((snapshot.ap ?? 0) + delta);
          snapshot.ap = this.clampNonNegative(ap);
          if (snapshot.fieldCardValue) {
            snapshot.fieldCardValue = {
              ...snapshot.fieldCardValue,
              totalAP: this.clampNonNegative(nextValue ?? this.clampNonNegative((snapshot.fieldCardValue.totalAP ?? 0) + delta)),
            };
          }
        } else if (stat.includes("hp")) {
          snapshot.hp = nextValue ?? (snapshot.hp ?? 0) + delta;
          if (snapshot.fieldCardValue) {
            snapshot.fieldCardValue = {
              ...snapshot.fieldCardValue,
              totalHP: nextValue ?? (snapshot.fieldCardValue.totalHP ?? 0) + delta,
            };
          }
        }
        this.renderSnapshots.set(key, snapshot);
      });
    }

    if (type === "CARD_DAMAGED") {
      const payload = event.payload ?? {};
      const displayValue = Number(payload?.displayValue ?? payload?.resultingHP);
      const hasDisplayValue = Number.isFinite(displayValue);
      const damage = Number(payload?.damage ?? 0);
      const delta = Number.isFinite(damage) ? -damage : 0;
      if (!hasDisplayValue && delta === 0) {
        return this.buildSlotsForRender(currentSlots);
      }
      keys.forEach((key) => {
        const base = this.renderSnapshots.get(key);
        if (!base) return;
        const snapshot = this.cloneSlot(base);
        const nextValue = hasDisplayValue ? displayValue : undefined;
        snapshot.hp = nextValue ?? (snapshot.hp ?? 0) + delta;
        if (snapshot.fieldCardValue) {
          snapshot.fieldCardValue = {
            ...snapshot.fieldCardValue,
            totalHP: nextValue ?? (snapshot.fieldCardValue.totalHP ?? 0) + delta,
          };
        }
        this.renderSnapshots.set(key, snapshot);
      });
    }
    
    if (type === "UNIT_ATTACK_DECLARED") {
      const attackerUid = event.payload?.attackerCarduid;
      if (attackerUid) {
        const attackerSlot = currentSlots.find(
          (slot) => slot.unit?.cardUid === attackerUid || slot.pilot?.cardUid === attackerUid,
        );
        if (attackerSlot) {
          const key = `${attackerSlot.owner}-${attackerSlot.slotId}`;
          const base = this.renderSnapshots.get(key) ?? this.cloneSlot(attackerSlot);
          if (base) {
            const snapshot = this.cloneSlot(base);
            snapshot.isRested = true;
            if (snapshot.unit) snapshot.unit.isRested = true;
            this.renderSnapshots.set(key, snapshot);
          }
        }
      }
    }

   
    return this.buildSlotsForRender(currentSlots);
  }

  handleEventEnd(event: SlotNotification, ctx: AnimationContext): SlotViewModel[] | null {
    const keys = this.eventSlots.get(event.id) ?? [];
    const raw = ctx.currentRaw ?? ctx.previousRaw;
    if (!raw) return null;
    const currentSlots = this.getSlotsFromRaw(raw);
    const type = (event.type || "").toUpperCase();
    const releaseSlots = () => keys.forEach((key) => this.runningSlots.delete(key));
    releaseSlots();

    if (type === "REFRESH_TARGET") {
      keys.forEach((key) => {
        const base = this.renderSnapshots.get(key);
        if (!base) return;
        const snapshot = this.cloneSlot(base);
        snapshot.isRested = true;
        if (snapshot.unit) snapshot.unit.isRested = true;
        if (snapshot.pilot) snapshot.pilot.isRested = true;
        this.renderSnapshots.set(key, snapshot);
      });
      return this.buildSlotsForRender(currentSlots);
    }

    if (type === "UNIT_ATTACK_DECLARED" || 
        type =="PHASE_CHANGED" ||
        type === "CARD_STAT_MODIFIED" ||
        type === "CARD_DAMAGED") {
      // Keep preview snapshot (rested) for this event; just unhide affected slots.
      return this.buildSlotsForRender(currentSlots);
    }
    const byKey = new Map(currentSlots.map((slot) => [`${slot.owner}-${slot.slotId}`, slot]));
    // Default: copy current slot state into the snapshot when the event finishes.
    // TODO: override per event type when we need custom slot label updates.
    keys.forEach((key) => {
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

  getRenderSlots(currentSlots: SlotViewModel[]) {
    return this.buildSlotsForRender(currentSlots);
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
