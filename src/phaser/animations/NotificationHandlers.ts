import type { AnimationContext } from "./AnimationTypes";
import type { SlotNotification } from "./NotificationAnimationController";
import type { NotificationAnimationController } from "./NotificationAnimationController";
import type { BattleAnimationManager } from "./BattleAnimationManager";
import type { AttackIndicatorController } from "../controllers/AttackIndicatorController";

export type NotificationHandler = (event: SlotNotification, ctx: AnimationContext) => Promise<void>;

export function buildNotificationHandlers(
  deps: {
    cardPlayAnimator: NotificationAnimationController;
    battleAnimator: BattleAnimationManager;
    attackIndicator: AttackIndicatorController;
    phasePopup?: { showPhaseChange: (nextPhase: string) => Promise<void> | void };
  },
  helpers: {
    triggerStatPulse: (event: SlotNotification, ctx: AnimationContext) => Promise<void>;
  },
) {
  return new Map<string, NotificationHandler>([
    [
      "CARD_PLAYED_COMPLETED",
      async (event, ctx) => {
        await deps.cardPlayAnimator.playCardPlayed(event, {
          slots: ctx.slots,
          boardSlotPositions: ctx.boardSlotPositions,
          currentPlayerId: ctx.currentPlayerId,
          cardLookup: ctx.cardLookup,
          allowAnimations: ctx.allowAnimations,
        });
      },
    ],
    [
      "CARD_DRAWN",
      async (event, ctx) => {
        await deps.cardPlayAnimator.playCardDrawn(event, {
          slots: ctx.slots,
          currentPlayerId: ctx.currentPlayerId,
          allowAnimations: ctx.allowAnimations,
          cardLookup: ctx.cardLookup,
          resolveSlotOwnerByPlayer: ctx.resolveSlotOwnerByPlayer,
        });
      },
    ],
    [
      "UNIT_ATTACK_DECLARED",
      async (event, ctx) => {
        await deps.attackIndicator.updateFromNotification(
          event,
          ctx.slots,
          ctx.boardSlotPositions ?? undefined,
        );
      },
    ],
    [
      "REFRESH_TARGET",
      async (event, ctx) => {
        await deps.attackIndicator.updateFromNotification(
          event,
          ctx.slots,
          ctx.boardSlotPositions ?? undefined,
        );
      },
    ],
    [
      "BATTLE_RESOLVED",
      async (event, ctx) => {
        deps.attackIndicator.clear();
        await deps.battleAnimator.playBattleResolution(
          event,
          ctx.getRenderSlots ? ctx.getRenderSlots() : ctx.slots,
          ctx.boardSlotPositions ?? undefined,
        );
      },
    ],
    [
      "CARD_STAT_MODIFIED",
      async (event, ctx) => {
        await helpers.triggerStatPulse(event, ctx);
      },
    ],
    [
      "PHASE_CHANGED",
      async (event) => {
        const nextPhase = event?.payload?.nextPhase;
        if (!nextPhase) return;
        await Promise.resolve(deps.phasePopup?.showPhaseChange(nextPhase));
      },
    ],
  ]);
}
