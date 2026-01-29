import type { AnimationContext } from "./AnimationTypes";
import type { SlotNotification } from "./NotificationAnimationController";
import type { NotificationAnimationController } from "./NotificationAnimationController";
import type { BattleAnimationManager } from "./BattleAnimationManager";
import type { AttackIndicatorController } from "../controllers/AttackIndicatorController";
import type { EffectTargetController } from "../controllers/EffectTargetController";
import type { GameEndInfo } from "../scene/gameEndHelpers";
import { createLogger } from "../utils/logger";

export type NotificationHandler = (event: SlotNotification, ctx: AnimationContext) => Promise<void>;

export function buildNotificationHandlers(
  deps: {
    cardPlayAnimator: NotificationAnimationController;
    battleAnimator: BattleAnimationManager;
    attackIndicator: AttackIndicatorController;
    effectTargetController?: EffectTargetController;
    onGameEnded?: (info: GameEndInfo) => void;
    burstChoiceFlow?: import("../controllers/BurstChoiceFlowManager").BurstChoiceFlowManager;
    phasePopup?: { showPhaseChange: (nextPhase: string) => Promise<void> | void };
    mulliganDialog?: {
      showPrompt: (opts: { prompt?: string; onYes?: () => Promise<void> | void; onNo?: () => Promise<void> | void }) => Promise<boolean>;
    };
    chooseFirstPlayerDialog?: {
      showPrompt: (opts: {
        onFirst?: () => Promise<void> | void;
        onSecond?: () => Promise<void> | void;
      }) => Promise<boolean>;
    };
    onTurnStartDrawPopupStart?: () => void;
    onTurnStartDrawPopupEnd?: () => void;
    turnOrderStatusDialog?: { showMessage: (promptText: string, headerText?: string) => void; hide: () => void };
    waitingOpponentDialog?: { hide: () => void };
    mulliganWaitingDialog?: { hide: () => void };
    coinFlipOverlay?: { play: () => Promise<void> | void };
    startGame?: () => Promise<void> | void;
    startReady?: (isRedraw: boolean) => Promise<void> | void;
    chooseFirstPlayer?: (chosenFirstPlayerId: string) => Promise<void> | void;
  },
  helpers: {
    triggerStatPulse: (event: SlotNotification, ctx: AnimationContext) => Promise<void>;
  },
) {
  const log = createLogger("NotificationHandlers");
  return new Map<string, NotificationHandler>([
    [
      "TARGET_CHOICE",
      async (event, ctx) => {
        if (!deps.effectTargetController) return;
        await deps.effectTargetController.handleTargetChoiceNotification(event, ctx.currentRaw);
      },
    ],
    [
      "GAME_ENDED",
      async (event) => {
        const payload = event?.payload ?? {};
        deps.onGameEnded?.({
          winnerId: payload.winnerId,
          endReason: payload.reason ?? payload.endReason,
          endedAt: payload.timestamp ?? payload.endedAt,
        });
      },
    ],
    [
      "BURST_EFFECT_CHOICE",
      async (event, ctx) => {
        if (!deps.burstChoiceFlow) return;
        await deps.burstChoiceFlow.handleNotification(event, ctx.currentRaw);
      },
    ],
    [
      "BURST_EFFECT_CHOICE_RESOLVED",
      async (event) => {
        if (!deps.burstChoiceFlow) return;
        await deps.burstChoiceFlow.handleResolvedNotification(event);
      },
    ],
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
        const drawContext = (event?.payload?.drawContext ?? "").toString().toLowerCase();
        const playerId = event?.payload?.playerId;
        const isSelf = !!playerId && !!ctx.currentPlayerId && playerId === ctx.currentPlayerId;
        const contextPlayerId =
          ctx.currentRaw?.gameEnv?.currentPlayer ?? ctx.currentRaw?.currentPlayer;
        const isContextPlayer = !!playerId && !!contextPlayerId && playerId === contextPlayerId;
        const shouldDelayTimer = drawContext === "turn_start" && isSelf && isContextPlayer;
        if (shouldDelayTimer) {
          log.debug("CARD_DRAWN turn_start delay start", {
            eventId: event?.id,
            playerId,
            contextPlayerId,
            drawContext,
          });
        }
        if (shouldDelayTimer) {
          deps.onTurnStartDrawPopupStart?.();
        }
        try {
          await deps.cardPlayAnimator.playCardDrawn(event, {
            slots: ctx.slots,
            currentPlayerId: ctx.currentPlayerId,
            allowAnimations: ctx.allowAnimations,
            cardLookup: ctx.cardLookup,
            resolveSlotOwnerByPlayer: ctx.resolveSlotOwnerByPlayer,
          });
        } finally {
          if (shouldDelayTimer) {
            log.debug("CARD_DRAWN turn_start delay end", {
              eventId: event?.id,
              playerId,
              contextPlayerId,
            });
            deps.onTurnStartDrawPopupEnd?.();
          }
        }
      },
    ],
    [
      "CARD_ADDED_TO_HAND",
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
        if (ctx.allowAnimations) {
          await deps.battleAnimator.playBattleResolution(
            event,
            ctx.getRenderSlots ? ctx.getRenderSlots() : ctx.slots,
            ctx.boardSlotPositions ?? undefined,
            ctx.currentRaw,
          );
        }
        const result = event?.payload?.result ?? {};
        if (result?.gameEnded) {
          deps.onGameEnded?.({
            winnerId: result.winnerId ?? event?.payload?.winnerId,
            endReason: result.endReason ?? result.reason,
            endedAt: result.endedAt ?? result.timestamp,
          });
        }
      },
    ],
    [
      "CARD_STAT_MODIFIED",
      async (event, ctx) => {
        await helpers.triggerStatPulse(event, ctx);
      },
    ],
    [
      "CARD_DAMAGED",
      async (event, ctx) => {
        await helpers.triggerStatPulse(event, ctx);
      },
    ],
    [
      "PHASE_CHANGED",
      async (event) => {
        const nextPhase = event?.payload?.nextPhase;
        if (!nextPhase) return;
        deps.turnOrderStatusDialog?.hide();
        deps.waitingOpponentDialog?.hide();
        deps.mulliganWaitingDialog?.hide();
        const displayPhase = nextPhase === "REDRAW_PHASE" ? "START GAME" : nextPhase;
        await Promise.resolve(deps.phasePopup?.showPhaseChange(displayPhase));
      },
    ],
    [
      "INIT_HAND",
      async (event, ctx) => {
        const playerId = event?.payload?.playerId;
        if (!playerId || playerId !== ctx.currentPlayerId) return;
        await Promise.resolve(deps.startGame?.());

        await Promise.resolve(
          deps.mulliganDialog?.showPrompt({
            prompt: "Do you want mulligan?",
            onYes: () => deps.startReady?.(true),
            onNo: () => deps.startReady?.(false),
          }),
        );
      },
    ],
    [
      "CHOOSE_FIRST_PLAYER",
      async (event, ctx) => {
        deps.waitingOpponentDialog?.hide();
        deps.mulliganWaitingDialog?.hide();
        const chooserId = event?.payload?.chooserId;
        await Promise.resolve(deps.coinFlipOverlay?.play());
        if (!chooserId || chooserId !== ctx.currentPlayerId) {
          deps.turnOrderStatusDialog?.showMessage("Opponent is deciding Turn Order...");
          return;
        }
        const player1 = event?.payload?.playerId_1;
        const player2 = event?.payload?.playerId_2;
        if (!player1 || !player2) return;
        const otherId = chooserId === player1 ? player2 : player1;

        await Promise.resolve(
          deps.chooseFirstPlayerDialog?.showPrompt({
            onFirst: () => deps.chooseFirstPlayer?.(chooserId),
            onSecond: () => deps.chooseFirstPlayer?.(otherId),
          }),
        );
      },
    ],
  ]);
}
