import type { AnimationContext, AnimationEvent } from "./AnimationTypes";
import type { NotificationAnimationController } from "./NotificationAnimationController";
import type { BattleAnimationManager } from "./BattleAnimationManager";
import type { AttackIndicatorController } from "../controllers/AttackIndicatorController";
type StatPulseControls = {
  playStatPulse?: (slotKey: string, delta: number) => Promise<void> | void;
};

export class AnimationExecutor {
  constructor(
    private deps: {
      cardPlayAnimator: NotificationAnimationController;
      battleAnimator: BattleAnimationManager;
      attackIndicator: AttackIndicatorController;
      slotControls?: StatPulseControls | null;
    },
  ) {}

  async run(event: AnimationEvent, ctx: AnimationContext): Promise<void> {
    if (!ctx.allowAnimations) return;
    switch (event.type) {
      case "CARD_PLAYED":
        await this.deps.cardPlayAnimator.playCardPlayed(event.note, {
          slots: ctx.slots,
          boardSlotPositions: ctx.boardSlotPositions,
          currentPlayerId: ctx.currentPlayerId,
          cardLookup: ctx.cardLookup,
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
    const slotKey = this.resolveSlotKey(payload, ctx);
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

  private resolveSlotKey(payload: any, ctx: AnimationContext): string | undefined {
    const owner = ctx.resolveSlotOwnerByPlayer(payload?.playerId);
    const zone = typeof payload?.zone === "string" ? payload.zone : undefined;
    const slotId = zone || payload?.slotId || payload?.slot;
    if (owner && slotId) {
      return `${owner}-${slotId}`;
    }
    const cardUid = payload?.carduid ?? payload?.cardUid;
    if (cardUid) {
      const slot = ctx.slots.find(
        (entry) => entry.unit?.cardUid === cardUid || entry.pilot?.cardUid === cardUid,
      );
      if (slot) {
        return `${slot.owner}-${slot.slotId}`;
      }
    }
    return undefined;
  }
}
