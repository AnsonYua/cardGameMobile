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
  private debug = true;

  constructor(private getSlotsFromRaw: (raw: any) => SlotViewModel[]) {}

  startBatch(
    events: SlotNotification[],
    previousSlots: SlotViewModel[],
    currentSlots: SlotViewModel[],
  ): SlotViewModel[] {
    if (this.debug) {
      // eslint-disable-next-line no-console
      console.log("[SlotRender] startBatch", { eventCount: events.length });
    }
    this.initRenderSnapshots(events, previousSlots, currentSlots);
    return this.buildSlotsForRender(currentSlots);
  }

  handleEventStart(event: SlotNotification, currentSlots: SlotViewModel[]): SlotViewModel[] {
    const keys = this.eventSlots.get(event.id) ?? [];
    const type = (event.type || "").toUpperCase();
    if (this.debug) {
      // eslint-disable-next-line no-console
      console.log("[SlotRender] event start", {
        id: event.id,
        type,
        keys,
        snapshots: keys.map((key) => ({ key, state: this.renderSnapshots.get(key) ? "set" : "null" })),
      });
    }
    if (type === "CARD_STAT_MODIFIED") {
      const delta = Number(event.payload?.delta ?? event.payload?.modifierValue ?? 0);
      const stat = (event.payload?.stat ?? "").toString().toLowerCase();
      keys.forEach((key) => {
        const base = this.renderSnapshots.get(key);
        if (!base) return;
        const snapshot = this.cloneSlot(base);
        if (stat.includes("ap")) {
          snapshot.ap = (snapshot.ap ?? 0) + delta;
          if (snapshot.fieldCardValue) {
            snapshot.fieldCardValue = {
              ...snapshot.fieldCardValue,
              totalAP: (snapshot.fieldCardValue.totalAP ?? 0) + delta,
            };
          }
        } else if (stat.includes("hp")) {
          snapshot.hp = (snapshot.hp ?? 0) + delta;
          if (snapshot.fieldCardValue) {
            snapshot.fieldCardValue = {
              ...snapshot.fieldCardValue,
              totalHP: (snapshot.fieldCardValue.totalHP ?? 0) + delta,
            };
          }
        }
        this.renderSnapshots.set(key, snapshot);
      });
    }
    
    if (type === "UNIT_ATTACK_DECLARED") {
      const attackerUid = event.payload?.attackerCarduid;
      if (this.debug) {
        // eslint-disable-next-line no-console
        console.log("[SlotRender] attack declared", { attackerUid });
      }
      if (attackerUid) {
        const attackerSlot = currentSlots.find(
          (slot) => slot.unit?.cardUid === attackerUid || slot.pilot?.cardUid === attackerUid,
        );
        if (this.debug) {
          // eslint-disable-next-line no-console
          console.log("[SlotRender] attack resolved", {
            attackerUid,
            found: !!attackerSlot,
            key: attackerSlot ? `${attackerSlot.owner}-${attackerSlot.slotId}` : null,
          });
        }
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
    if (type === "CARD_STAT_MODIFIED") {
      // Keep preview snapshot for this event; just unhide affected slots.
      return this.buildSlotsForRender(currentSlots);
    }
    
    if (type === "UNIT_ATTACK_DECLARED") {
      // Keep preview snapshot (rested) for this event; just unhide affected slots.
      return this.buildSlotsForRender(currentSlots);
    }
    const byKey = new Map(currentSlots.map((slot) => [`${slot.owner}-${slot.slotId}`, slot]));
    // Default: copy current slot state into the snapshot when the event finishes.
    // TODO: override per event type when we need custom slot label updates.
    keys.forEach((key) => {
      const slot = byKey.get(key);
      if (this.debug) {
        // eslint-disable-next-line no-console
        console.log("[SlotRender] event end slot", {
          type,
          key,
          slotRested: slot?.isRested,
          unitRested: slot?.unit?.isRested,
          pilotRested: slot?.pilot?.isRested,
        });
      }
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
    if (this.debug) {
      // eslint-disable-next-line no-console
      console.log("[SlotRender] init snapshots", {
        events: events.map((e) => ({ id: e.id, type: e.type })),
      });
    }
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
      if (this.debug) {
        // eslint-disable-next-line no-console
        console.log("[SlotRender] init event", { id: event.id, type: event.type, keys: Array.from(keys) });
      }
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
      if (this.debug) {
        // eslint-disable-next-line no-console
        console.log("[SlotRender] build", {
          key,
          currentRested: slot.isRested,
          snapshotRested: snapshot?.isRested,
          usingSnapshot: !!snapshot,
          hidden: isHidden(key, snapshot),
        });
      }
      if (this.debug && (this.runningSlots.has(key) || snapshot === null)) {
        // eslint-disable-next-line no-console
        console.log("[SlotRender] hide slot", {
          key,
          reason: this.runningSlots.has(key) ? "running" : "snapshot-null",
        });
      }
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
