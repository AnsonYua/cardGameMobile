import type Phaser from "phaser";
import { createAnimationPipeline } from "../controllers/AnimationPipeline";
import type { AnimationQueue } from "../animations/AnimationQueue";
import type { SlotAnimationRenderController } from "../animations/SlotAnimationRenderController";
import type { BaseShieldAnimationRenderController } from "../animations/BaseShieldAnimationRenderController";
import type { TargetAnchorProviders } from "../utils/AttackResolver";
import type { SlotPresenter } from "../ui/SlotPresenter";
import type { GameEngine } from "../game/GameEngine";
import type { ApiManager } from "../api/ApiManager";
import type { DialogCoordinator } from "../controllers/DialogCoordinator";
import type { SlotOwner, SlotViewModel } from "../ui/SlotTypes";
import type { SlotNotification } from "../animations/NotificationAnimationController";
import type { DrawPopupDialog } from "../ui/DrawPopupDialog";
import type { MulliganDialog } from "../ui/MulliganDialog";
import type { ChooseFirstPlayerDialog } from "../ui/ChooseFirstPlayerDialog";
import type { TurnOrderStatusDialog } from "../ui/TurnOrderStatusDialog";
import type { CoinFlipOverlay } from "../ui/CoinFlipOverlay";
import type { PhaseChangeDialog } from "../ui/PhaseChangeDialog";
import type { BoardUiControls } from "./boardUiSetup";
import type { GameEndInfo } from "./gameEndHelpers";
import type { EffectTargetController } from "../controllers/EffectTargetController";

export type AnimationPipelineSetup = {
  animationQueue: AnimationQueue;
  slotAnimationRender: SlotAnimationRenderController;
  baseShieldAnimationRender: BaseShieldAnimationRenderController;
};

export type AnimationPipelineParams = {
  scene: Phaser.Scene;
  controls: Pick<BoardUiControls, "slotControls" | "handControls">;
  effectTargetController?: EffectTargetController | null;
  dialogs: {
    drawPopupDialog: DrawPopupDialog;
    mulliganDialog: MulliganDialog;
    chooseFirstPlayerDialog: ChooseFirstPlayerDialog;
    turnOrderStatusDialog: TurnOrderStatusDialog;
    waitingOpponentDialog: TurnOrderStatusDialog;
    mulliganWaitingDialog: TurnOrderStatusDialog;
    coinFlipOverlay: CoinFlipOverlay;
    phaseChangeDialog: PhaseChangeDialog;
  };
  api: ApiManager;
  engine: GameEngine;
  dialogCoordinator: DialogCoordinator;
  gameContext: { gameId?: string | null; playerId?: string | null };
  slotPresenter: SlotPresenter;
  burstFlow?: import("../controllers/BurstChoiceFlowManager").BurstChoiceFlowManager;
  resolveSlotOwnerByPlayer: (playerId?: string) => SlotOwner | undefined;
  getTargetAnchorProviders: () => TargetAnchorProviders;
  startGame: () => void;
  renderSlots: (slots: SlotViewModel[]) => void;
  renderBaseAndShield: (raw?: any) => void;
  updateHandArea: (opts: { skipAnimation?: boolean }) => void;
  shouldRefreshHandForEvent: (event: SlotNotification) => boolean;
  handleAnimationQueueIdle: () => void;
  onGameEnded?: (info: GameEndInfo) => void;
  onTurnStartDrawPopupStart?: () => void;
  onTurnStartDrawPopupEnd?: () => void;
};

export function setupAnimationPipeline(params: AnimationPipelineParams): AnimationPipelineSetup {
  const {
    scene,
    controls,
    effectTargetController,
    dialogs,
    api,
    engine,
    dialogCoordinator,
    gameContext,
    slotPresenter,
    burstFlow,
    resolveSlotOwnerByPlayer,
    getTargetAnchorProviders,
    startGame,
    renderSlots,
    renderBaseAndShield,
    updateHandArea,
    shouldRefreshHandForEvent,
    handleAnimationQueueIdle,
    onTurnStartDrawPopupStart,
    onTurnStartDrawPopupEnd,
  } = params;

  const animationPipeline = createAnimationPipeline({
    scene,
    slotControls: controls.slotControls,
    handControls: controls.handControls,
    effectTargetController: effectTargetController ?? undefined,
    onGameEnded: params.onGameEnded,
    drawPopupDialog: dialogs.drawPopupDialog,
    mulliganDialog: dialogs.mulliganDialog,
    chooseFirstPlayerDialog: dialogs.chooseFirstPlayerDialog,
    onTurnStartDrawPopupStart,
    onTurnStartDrawPopupEnd,
    turnOrderStatusDialog: dialogs.turnOrderStatusDialog,
    waitingOpponentDialog: dialogs.waitingOpponentDialog,
    mulliganWaitingDialog: dialogs.mulliganWaitingDialog,
    coinFlipOverlay: dialogs.coinFlipOverlay,
    phaseChangeDialog: dialogs.phaseChangeDialog,
    burstFlow,
    startGame: () => startGame(),
    startReady: async (isRedraw) => {
      const gameId = gameContext.gameId;
      const playerId = gameContext.playerId;
      if (!gameId || !playerId) {
        return;
      }
      dialogCoordinator.markMulliganDecisionSubmitted();
      await api.startReady({ gameId, playerId, isRedraw });
      const snapshot = await engine.updateGameStatus(gameId, playerId);
      dialogCoordinator.updateFromSnapshot(snapshot);
    },
    chooseFirstPlayer: async (chosenFirstPlayerId) => {
      const gameId = gameContext.gameId;
      const playerId = gameContext.playerId;
      if (!gameId || !playerId) {
        return;
      }
      await api.chooseFirstPlayer({ gameId, playerId, chosenFirstPlayerId });
      await engine.updateGameStatus(gameId, playerId);
    },
    resolveSlotOwnerByPlayer,
    getTargetAnchorProviders,
    getSlotsFromRaw: (data) => slotPresenter.toSlots(data, gameContext.playerId ?? ""),
  });

  const { animationQueue, slotAnimationRender, baseShieldAnimationRender } = animationPipeline;

  animationQueue.setOnIdle(() => handleAnimationQueueIdle());
  animationQueue.setOnEventStart((event, ctx) => {
    const slots = slotAnimationRender.handleEventStart(
      event,
      slotPresenter.toSlots(ctx.currentRaw ?? ctx.previousRaw, gameContext.playerId ?? ""),
    );
    if (slots) {
      renderSlots(slots);
    }
    baseShieldAnimationRender.handleEventStart(event, ctx);
  });
  animationQueue.setOnEventEnd((event, ctx) => {
    const slots = slotAnimationRender.handleEventEnd(event, ctx);
    if (slots) {
      renderSlots(slots);
    }
    baseShieldAnimationRender.handleEventEnd(event, ctx);
    if ((event?.type ?? "").toString().toUpperCase() === "BATTLE_RESOLVED") {
      renderBaseAndShield(ctx.currentRaw ?? ctx.previousRaw);
    }
    if (shouldRefreshHandForEvent(event)) {
      updateHandArea({ skipAnimation: true });
      controls.handControls?.scrollToEnd?.(true);
    }
  });

  return { animationQueue, slotAnimationRender, baseShieldAnimationRender };
}
