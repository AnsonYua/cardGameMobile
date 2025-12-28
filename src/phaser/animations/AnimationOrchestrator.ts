import type { SlotNotification } from "./NotificationAnimationController";
import type { SlotViewModel, SlotOwner, SlotPositionMap } from "../ui/SlotTypes";
import type { NotificationAnimationController } from "./NotificationAnimationController";
import type { BattleAnimationManager } from "./BattleAnimationManager";

export type SlotAnimationContext = {
  notifications: SlotNotification[];
  slots: SlotViewModel[];
  slotPositions?: SlotPositionMap | null;
  slotAreaCenter?: (owner: SlotOwner) => { x: number; y: number } | undefined;
  raw: any;
  allowAnimations: boolean;
  currentPlayerId: string | null;
  shouldHideSlot?: (slotKey: string) => boolean;
  attackSnapshotNote?: SlotNotification;
  slotControls?: Parameters<BattleAnimationManager["setSlotControls"]>[0] | null;
};

export interface AnimationHandler {
  prepare?(ctx: SlotAnimationContext): void;
  handle(ctx: SlotAnimationContext): Promise<void> | void;
  getLockedSlots?(): Map<string, SlotViewModel>;
}

export class AnimationOrchestrator {
  private handlers: AnimationHandler[];

  constructor(handlers: AnimationHandler[]) {
    this.handlers = handlers.filter(Boolean);
  }

  setHandlers(handlers: AnimationHandler[]) {
    this.handlers = handlers.filter(Boolean);
  }

  run(ctx: SlotAnimationContext): Promise<void> {
    this.handlers.forEach((handler) => handler.prepare?.(ctx));
    let chain = Promise.resolve();
    this.handlers.forEach((handler) => {
      chain = chain.then(() => handler.handle(ctx));
    });
    return chain;
  }

  getLockedSlots(): Map<string, SlotViewModel> {
    const locked = new Map<string, SlotViewModel>();
    this.handlers.forEach((handler) => {
      const snapshot = handler.getLockedSlots?.();
      snapshot?.forEach((slot, key) => locked.set(key, slot));
    });
    return locked;
  }
}

export class NotificationAnimationHandler implements AnimationHandler {
  constructor(private animator: NotificationAnimationController) {}

  handle(ctx: SlotAnimationContext) {
    return this.animator.process({
      notifications: ctx.notifications,
      slots: ctx.slots,
      slotPositions: ctx.slotPositions ?? undefined,
      slotAreaCenter: ctx.slotAreaCenter,
      raw: ctx.raw,
      allowAnimations: ctx.allowAnimations,
      currentPlayerId: ctx.currentPlayerId,
      shouldHideSlot: ctx.shouldHideSlot,
    });
  }

  getLockedSlots() {
    return this.animator.getLockedSlots();
  }
}

export class BattleAnimationHandler implements AnimationHandler {
  constructor(private battle: BattleAnimationManager) {}

  prepare(ctx: SlotAnimationContext) {
    this.battle.setSlotControls(ctx.slotControls ?? null);
    this.battle.captureAttackSnapshot(ctx.attackSnapshotNote, ctx.slots, ctx.slotPositions ?? null);
  }

  handle(ctx: SlotAnimationContext) {
    this.battle.processBattleResolutionNotifications(ctx.notifications);
  }

  getLockedSlots() {
    return this.battle.getLockedSlots();
  }
}
