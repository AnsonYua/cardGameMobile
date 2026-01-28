import type { SlotOwner } from "../ui/SlotTypes";
import type { AnimationContext } from "./AnimationTypes";
import type { SlotNotification } from "./NotificationAnimationController";

export type BaseSide = "player" | "opponent";

export type BaseShieldState = {
  baseCard: any | null;
  shieldCount: number;
  ap: number;
  hp: number;
  rested: boolean;
};

export class BaseShieldAnimationRenderController {
  private renderSnapshots = new Map<BaseSide, BaseShieldState | null>();
  private eventSides = new Map<string, BaseSide[]>();

  constructor(private resolveSlotOwnerByPlayer: (playerId?: string) => SlotOwner | undefined) {}

  startBatch(events: SlotNotification[], previousRaw: any, currentRaw: any) {
    this.renderSnapshots.clear();
    this.eventSides.clear();

    const previousStates = this.buildStateBySide(previousRaw ?? currentRaw);
    const currentStates = this.buildStateBySide(currentRaw);

    events.forEach((event) => {
      if (!event?.id) return;
      const sides = this.resolveSidesForEvent(event, currentStates);
      this.eventSides.set(event.id, sides);
      sides.forEach((side) => {
        if (this.renderSnapshots.has(side)) return;
        const base = previousStates.get(side) ?? currentStates.get(side) ?? null;
        this.renderSnapshots.set(side, this.cloneState(base));
      });
    });
  }

  handleEventStart(event: SlotNotification, ctx: AnimationContext) {
    if (!event?.id) return;
    const type = (event.type || "").toUpperCase();
    if (type !== "CARD_STAT_MODIFIED") return;

    const payload = event.payload ?? {};
    const delta = Number(payload.delta ?? payload.modifierValue ?? 0);
    if (!delta) return;
    const stat = (payload.stat ?? "").toString().toLowerCase();
    const cardUid = this.getPayloadCardUid(payload);
    if (!cardUid) return;

    const sides =
      this.eventSides.get(event.id) ??
      this.resolveSidesForEvent(event, this.buildStateBySide(ctx.currentRaw ?? ctx.previousRaw));
    sides.forEach((side) => {
      const snapshot = this.renderSnapshots.get(side);
      if (!snapshot?.baseCard) return;
      const baseUid = this.getCardUid(snapshot.baseCard);
      if (!baseUid || baseUid !== cardUid) return;
      const next = this.cloneState(snapshot);
      if (!next) return;
      this.applyStatDelta(next, stat, delta);
      this.renderSnapshots.set(side, next);
    });
  }

  handleEventEnd(event: SlotNotification, ctx: AnimationContext) {
    if (!event?.id) return;
    const raw = ctx.currentRaw ?? ctx.previousRaw;
    if (!raw) return;
    const states = this.buildStateBySide(raw);
    const sides = this.eventSides.get(event.id) ?? [];
    sides.forEach((side) => {
      const state = states.get(side) ?? null;
      this.renderSnapshots.set(side, this.cloneState(state));
    });
  }

  getRenderStates(raw: any): Record<BaseSide, BaseShieldState | null> {
    const currentStates = this.buildStateBySide(raw);
    const result: Record<BaseSide, BaseShieldState | null> = {
      player: currentStates.get("player") ?? null,
      opponent: currentStates.get("opponent") ?? null,
    };
    this.renderSnapshots.forEach((snapshot, side) => {
      result[side] = snapshot ?? null;
    });
    return result;
  }

  clear() {
    this.renderSnapshots.clear();
    this.eventSides.clear();
  }

  private resolveSidesForEvent(event: SlotNotification, states: Map<BaseSide, BaseShieldState | null>): BaseSide[] {
    const payload = event.payload ?? {};
    const type = (event.type || "").toUpperCase();
    const sides = new Set<BaseSide>();
    const addByPlayerId = (playerId?: string) => {
      const owner = this.resolveSlotOwnerByPlayer(playerId);
      if (owner === "player" || owner === "opponent") {
        sides.add(owner);
      }
    };

    if (type === "CARD_PLAYED_COMPLETED") {
      const playAs = (payload.playAs ?? "").toString().toLowerCase();
      if (playAs === "base") {
        addByPlayerId(payload.playerId);
      }
    }

    const targetSlot = this.normalizeTargetSlot(payload);
    if (targetSlot.includes("base") || targetSlot.includes("shield")) {
      addByPlayerId(payload.defendingPlayerId ?? payload.target?.playerId ?? payload.targetPlayerId);
    }

    if (type === "CARD_STAT_MODIFIED") {
      const cardUid = this.getPayloadCardUid(payload);
      if (cardUid) {
        states.forEach((state, side) => {
          const baseUid = state?.baseCard ? this.getCardUid(state.baseCard) : undefined;
          if (baseUid && baseUid === cardUid) {
            sides.add(side);
          }
        });
      }
    }

    return Array.from(sides);
  }

  private normalizeTargetSlot(payload: any): string {
    const target =
      payload.targetSlotName ??
      payload.target?.slot ??
      payload.targetSlot ??
      payload.targetName ??
      payload.target?.name ??
      payload.target?.zoneType ??
      payload.targetZoneType ??
      payload.zoneType ??
      "";
    return target.toString().toLowerCase();
  }

  private buildStateBySide(raw: any): Map<BaseSide, BaseShieldState | null> {
    const result = new Map<BaseSide, BaseShieldState | null>();
    const players = raw?.gameEnv?.players ?? {};
    const unassigned: [string, any][] = [];
    Object.entries(players).forEach(([playerId, player]) => {
      const owner = this.resolveSlotOwnerByPlayer(playerId);
      if (owner === "player" || owner === "opponent") {
        const state = this.buildStateFromPlayer(player);
        result.set(owner, state);
      } else {
        unassigned.push([playerId, player]);
      }
    });
    if (!result.has("player") && unassigned.length > 0) {
      result.set("player", this.buildStateFromPlayer(unassigned[0][1]));
    }
    if (!result.has("opponent") && unassigned.length > 1) {
      result.set("opponent", this.buildStateFromPlayer(unassigned[1][1]));
    }
    return result;
  }

  private buildStateFromPlayer(player: any): BaseShieldState | null {
    if (!player) return null;
    const zones = player.zones || player.zone || {};
    const shieldArea = zones.shieldArea || player.shieldArea || [];
    const baseArr = zones.base || player.base;
    const baseCard = Array.isArray(baseArr) ? baseArr[0] : baseArr ?? null;
    const field = baseCard?.fieldCardValue || {};
    return {
      baseCard: this.cloneBaseCard(baseCard),
      shieldCount: Array.isArray(shieldArea) ? shieldArea.length : 0,
      ap: Number(field.totalAP ?? 0),
      hp: Number(field.totalHP ?? 0),
      rested: Boolean(baseCard?.isRested ?? field.isRested ?? false),
    };
  }

  private cloneBaseCard(card: any | null): any | null {
    if (!card || typeof card !== "object") return card ?? null;
    return {
      ...card,
      fieldCardValue: card.fieldCardValue ? { ...card.fieldCardValue } : card.fieldCardValue,
    };
  }

  private cloneState(state: BaseShieldState | null): BaseShieldState | null {
    if (!state) return null;
    return {
      ...state,
      baseCard: this.cloneBaseCard(state.baseCard),
    };
  }

  private applyStatDelta(state: BaseShieldState, stat: string, delta: number) {
    const card = state.baseCard;
    const field = card?.fieldCardValue ? { ...card.fieldCardValue } : {};
    if (stat.includes("ap")) {
      state.ap = (state.ap ?? 0) + delta;
      field.totalAP = state.ap;
    } else if (stat.includes("hp")) {
      state.hp = (state.hp ?? 0) + delta;
      field.totalHP = state.hp;
    }
    if (card) {
      state.baseCard = { ...card, fieldCardValue: field };
    }
  }

  private getPayloadCardUid(payload: any): string | undefined {
    return (
      payload.carduid ??
      payload.cardUid ??
      payload.targetCarduid ??
      payload.targetCardUid ??
      payload.attackerCarduid ??
      payload.attackerCardUid ??
      payload.unitCardUid
    );
  }

  private getCardUid(card: any): string | undefined {
    return card?.carduid ?? card?.cardUid ?? card?.uid ?? card?.id ?? card?.cardId;
  }
}
