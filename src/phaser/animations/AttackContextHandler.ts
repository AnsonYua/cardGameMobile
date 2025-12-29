import type { SlotNotification } from "./NotificationAnimationController";
import type { SlotPositionMap, SlotViewModel, SlotOwner } from "../ui/SlotTypes";
import {
  findActiveAttackNotification,
  findLatestAttackNotification,
  getActiveAttackTargetSlotKey,
  getUpcomingBattleSlotKeys,
} from "../utils/NotificationUtils";
import type { AnimationHandler, SlotAnimationContext } from "./AnimationOrchestrator";

export class AttackContextHandler implements AnimationHandler {
  prepare(ctx: SlotAnimationContext) {
    const notificationQueue = ctx.notifications;
    const resolveOwner = ctx.resolveSlotOwnerByPlayer ?? (() => undefined);
    const activeAttackNote = findActiveAttackNotification(notificationQueue);
    const pendingAttackSnapshotNote = findLatestAttackNotification(notificationQueue, { includeBattleEnd: true });
    const attackTargetSlotKey = getActiveAttackTargetSlotKey(activeAttackNote, resolveOwner);
    const battleSlotKeys = getUpcomingBattleSlotKeys(notificationQueue, resolveOwner);
    ctx.attackContext = {
      activeAttackNote,
      pendingAttackSnapshotNote,
      attackTargetSlotKey,
      battleSlotKeys,
    };
    ctx.attackSnapshotNote = pendingAttackSnapshotNote;
  }

  handle(ctx: SlotAnimationContext) {
    const activeAttackNote = ctx.attackContext?.activeAttackNote;
    ctx.attackIndicatorUpdate?.(
      ctx.notifications,
      ctx.slots,
      ctx.boardSlotPositions ?? undefined,
      activeAttackNote,
    );
  }
}
