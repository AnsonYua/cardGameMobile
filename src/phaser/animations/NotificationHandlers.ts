import type { AnimationContext } from "./AnimationTypes";
import type { SlotNotification } from "./NotificationAnimationController";
import type { NotificationAnimationController } from "./NotificationAnimationController";
import type { BattleAnimationManager } from "./BattleAnimationManager";
import type { AttackIndicatorController } from "../controllers/AttackIndicatorController";
import type { EffectTargetController } from "../controllers/EffectTargetController";
import type { GameEndInfo } from "../scene/gameEndHelpers";
import type { SlotViewModel } from "../ui/SlotTypes";
import { createLogger } from "../utils/logger";
import { handleGameEnvRefresh } from "./handlers/GameEnvRefreshHandler";
import { buildStatPulseNotificationEntries, createStatPulseHandler } from "./handlers/StatPulseNotificationHandlers";

export type NotificationHandler = (event: SlotNotification, ctx: AnimationContext) => Promise<void>;

export function buildNotificationHandlers(
  deps: {
    cardPlayAnimator: NotificationAnimationController;
    battleAnimator: BattleAnimationManager;
    attackIndicator: AttackIndicatorController;
    effectTargetController?: EffectTargetController;
    onGameEnded?: (info: GameEndInfo) => void;
    burstChoiceFlow?: import("../controllers/BurstChoiceFlowManager").BurstChoiceFlowManager;
    burstChoiceGroupFlow?: import("../controllers/BurstChoiceGroupFlowManager").BurstChoiceGroupFlowManager;
    optionChoiceFlow?: import("../controllers/OptionChoiceFlowManager").OptionChoiceFlowManager;
    promptChoiceFlow?: import("../controllers/PromptChoiceFlowManager").PromptChoiceFlowManager;
    tokenChoiceFlow?: import("../controllers/TokenChoiceFlowManager").TokenChoiceFlowManager;
    refreshSnapshot?: (event: SlotNotification, ctx: AnimationContext) => Promise<any> | any;
    getSlotsFromRaw?: (raw: any) => SlotViewModel[];
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
  const statPulseHandler = createStatPulseHandler(helpers.triggerStatPulse);
  const runWithTurnStartDrawDelay = async (
    event: SlotNotification,
    ctx: AnimationContext,
    eventType: "CARD_DRAWN" | "CARDS_DRAWN",
    runner: () => Promise<void>,
  ) => {
    const drawContext = (event?.payload?.drawContext ?? "").toString().toLowerCase();
    const playerId = event?.payload?.playerId;
    const isSelf = !!playerId && !!ctx.currentPlayerId && playerId === ctx.currentPlayerId;
    const contextPlayerId = ctx.currentRaw?.gameEnv?.currentPlayer ?? ctx.currentRaw?.currentPlayer;
    const isContextPlayer = !!playerId && !!contextPlayerId && playerId === contextPlayerId;
    const isGroupedPerCardDraw = eventType === "CARD_DRAWN" && !!event?.payload?.drawBatchId;
    const shouldDelayTimer =
      drawContext === "turn_start" && isSelf && isContextPlayer && !isGroupedPerCardDraw;
    if (shouldDelayTimer) {
      log.debug(`${eventType} turn_start delay start`, {
        eventId: event?.id,
        playerId,
        contextPlayerId,
        drawContext,
      });
      deps.onTurnStartDrawPopupStart?.();
    }
    try {
      await runner();
    } finally {
      if (shouldDelayTimer) {
        log.debug(`${eventType} turn_start delay end`, {
          eventId: event?.id,
          playerId,
          contextPlayerId,
        });
        deps.onTurnStartDrawPopupEnd?.();
      }
    }
  };
  return new Map<string, NotificationHandler>([
    [
      "GAME_ENV_REFRESH",
      async (event, ctx) => {
        try {
          await handleGameEnvRefresh(deps, event, ctx);
        } catch (err) {
          void err;
          log.debug("GAME_ENV_REFRESH refresh failed");
        }
      },
    ],
    [
      "TOKEN_CHOICE",
      async (event, ctx) => {
        if (!deps.tokenChoiceFlow) return;
        await deps.tokenChoiceFlow.handleNotification(event, ctx.currentRaw);
      },
    ],
    [
      "OPTION_CHOICE",
      async (event, ctx) => {
        if (!deps.optionChoiceFlow) return;
        // Keep choice prompts sequenced after prior animations by running them inside the animation queue.
        await deps.optionChoiceFlow.handleNotification(event, ctx.currentRaw);
      },
    ],
    [
      "PROMPT_CHOICE",
      async (event, ctx) => {
        if (!deps.promptChoiceFlow) return;
        await deps.promptChoiceFlow.handleNotification(event, ctx.currentRaw);
      },
    ],
    [
      "BURST_EFFECT_CHOICE_GROUP",
      async (event, ctx) => {
        if (!deps.burstChoiceGroupFlow) return;
        await deps.burstChoiceGroupFlow.handleNotification(event, ctx.currentRaw);
      },
    ],
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
          notificationId: event?.id,
          winnerId: payload.winnerId,
          loserId: payload.loserId,
          endReason: payload.reason ?? payload.endReason,
          endedAt: payload.endedAt ?? payload.timestamp ?? payload.endedAt,
        });
      },
    ],
    [
      "BURST_EFFECT_CHOICE",
      async (event, ctx) => {
        if (!deps.burstChoiceFlow) return;
        if (deps.burstChoiceGroupFlow?.isActive()) return;
        await deps.burstChoiceFlow.handleNotification(event, ctx.currentRaw);
      },
    ],
    [
      "BURST_EFFECT_CHOICE_RESOLVED",
      async (event) => {
        if (!deps.burstChoiceFlow) return;
        if (deps.burstChoiceGroupFlow?.isActive()) return;
        await deps.burstChoiceFlow.handleResolvedNotification(event);
      },
    ],
    [
      "CARD_PLAYED",
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
        await runWithTurnStartDrawDelay(event, ctx, "CARD_DRAWN", async () => {
          await deps.cardPlayAnimator.playCardDrawn(event, {
            slots: ctx.slots,
            currentPlayerId: ctx.currentPlayerId,
            allowAnimations: ctx.allowAnimations,
            cardLookup: ctx.cardLookup,
            resolveSlotOwnerByPlayer: ctx.resolveSlotOwnerByPlayer,
          });
        });
      },
    ],
    [
      "CARDS_DRAWN",
      async (event, ctx) => {
        await runWithTurnStartDrawDelay(event, ctx, "CARDS_DRAWN", async () => {
          await deps.cardPlayAnimator.playCardsDrawn(event, {
            slots: ctx.slots,
            currentPlayerId: ctx.currentPlayerId,
            allowAnimations: ctx.allowAnimations,
            cardLookup: ctx.cardLookup,
            resolveSlotOwnerByPlayer: ctx.resolveSlotOwnerByPlayer,
          });
        });
      },
    ],
    [
      "TOP_DECK_VIEWED",
      async (event, ctx) => {
        await deps.cardPlayAnimator.playTopDeckViewed(event, {
          slots: ctx.slots,
          currentPlayerId: ctx.currentPlayerId,
          allowAnimations: ctx.allowAnimations,
          cardLookup: ctx.cardLookup,
          notificationQueue: ctx.notificationQueue,
        });
      },
    ],
    [
      "CARDS_MOVED_TO_TRASH",
      async (event, ctx) => {
        await deps.cardPlayAnimator.playCardsMovedToTrash(event, {
          slots: ctx.slots,
          currentPlayerId: ctx.currentPlayerId,
          allowAnimations: ctx.allowAnimations,
          cardLookup: ctx.cardLookup,
          resolveSlotOwnerByPlayer: ctx.resolveSlotOwnerByPlayer,
        });
      },
    ],
    [
      "CARDS_MOVED_TO_DECK_BOTTOM",
      async (event, ctx) => {
        await deps.cardPlayAnimator.playCardsMovedToDeckBottom(event, {
          slots: ctx.slots,
          currentPlayerId: ctx.currentPlayerId,
          allowAnimations: ctx.allowAnimations,
          cardLookup: ctx.cardLookup,
          notificationQueue: ctx.notificationQueue,
          resolveSlotOwnerByPlayer: ctx.resolveSlotOwnerByPlayer,
        });
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
          const winnerId = result.winnerId ?? event?.payload?.winnerId;
          const loserId = result.loserId ?? event?.payload?.loserId;
          // If backend didn't include winner/loser, wait for an explicit GAME_ENDED notification instead of guessing.
          if (winnerId || loserId) {
            deps.onGameEnded?.({
              winnerId,
              loserId,
              endReason: result.endReason ?? result.reason,
              endedAt: result.endedAt ?? result.timestamp,
            });
          }
        }
      },
    ],
    ...buildStatPulseNotificationEntries(statPulseHandler),
    [
      "UNIT_DESTROYED_BY_EFFECT",
      async (_event, ctx) => {
        // Ensure destroyed units remain visible until this notification is sequenced in the animation queue.
        // (Without a handler, the event is filtered out and the unit can "pop" out immediately when the
        // latest snapshot already reflects the post-destroy state.)
        if (!ctx.allowAnimations) return;
        await new Promise<void>((resolve) => setTimeout(resolve, 180));
      },
    ],
    [
      "PHASE_CHANGED",
      async (event) => {
        const nextPhase = event?.payload?.nextPhase;
        if (!nextPhase) return;
        const previousPhase = event?.payload?.previousPhase;
        // Suppress internal battle flow phase flips; these can happen during the notification animation queue
        // and would otherwise spam the phase dialog.
        const prev = (previousPhase ?? "").toString().toUpperCase();
        const next = (nextPhase ?? "").toString().toUpperCase();
        if (
          (prev === "MAIN_PHASE" && next === "ACTION_STEP_PHASE") ||
          (prev === "ACTION_STEP_PHASE" && next === "MAIN_PHASE")
        ) {
          return;
        }
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
