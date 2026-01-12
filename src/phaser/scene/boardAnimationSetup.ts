import type Phaser from "phaser";
import { createAnimationPipeline } from "../controllers/AnimationPipeline";
import type { AnimationQueue } from "../animations/AnimationQueue";
import type { SlotAnimationRenderController } from "../animations/SlotAnimationRenderController";
import type { TargetAnchorProviders } from "../utils/AttackResolver";
import type { SlotPresenter } from "../ui/SlotPresenter";
import type { GameEngine } from "../game/GameEngine";
import type { ApiManager } from "../api/ApiManager";
import type { DialogCoordinator } from "../controllers/DialogCoordinator";
import type { SlotViewModel } from "../ui/SlotTypes";
import type { DrawPopupDialog } from "../ui/DrawPopupDialog";
import type { MulliganDialog } from "../ui/MulliganDialog";
import type { ChooseFirstPlayerDialog } from "../ui/ChooseFirstPlayerDialog";
import type { TurnOrderStatusDialog } from "../ui/TurnOrderStatusDialog";
import type { CoinFlipOverlay } from "../ui/CoinFlipOverlay";
import type { PhaseChangeDialog } from "../ui/PhaseChangeDialog";
import type { BoardUiControls } from "./boardUiSetup";

export type AnimationPipelineSetup = {
  animationQueue: AnimationQueue;
  slotAnimationRender: SlotAnimationRenderController;
};

export type AnimationPipelineParams = {
  scene: Phaser.Scene;
  controls: Pick<BoardUiControls, "slotControls" | "handControls">;
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
  resolveSlotOwnerByPlayer: (playerId: string) => unknown;
  getTargetAnchorProviders: () => TargetAnchorProviders;
  startGame: () => void;
  renderSlots: (slots: SlotViewModel[]) => void;
  updateHandArea: (opts: { skipAnimation?: boolean }) => void;
  shouldRefreshHandForEvent: (event: unknown) => boolean;
  handleAnimationQueueIdle: () => void;
};

export function setupAnimationPipeline(params: AnimationPipelineParams): AnimationPipelineSetup {
  const {
    scene,
    controls,
    dialogs,
    api,
    engine,
    dialogCoordinator,
    gameContext,
    slotPresenter,
    resolveSlotOwnerByPlayer,
    getTargetAnchorProviders,
    startGame,
    renderSlots,
    updateHandArea,
    shouldRefreshHandForEvent,
    handleAnimationQueueIdle,
  } = params;

  const animationPipeline = createAnimationPipeline({
    scene,
    slotControls: controls.slotControls,
    handControls: controls.handControls,
    drawPopupDialog: dialogs.drawPopupDialog,
    mulliganDialog: dialogs.mulliganDialog,
    chooseFirstPlayerDialog: dialogs.chooseFirstPlayerDialog,
    turnOrderStatusDialog: dialogs.turnOrderStatusDialog,
    waitingOpponentDialog: dialogs.waitingOpponentDialog,
    mulliganWaitingDialog: dialogs.mulliganWaitingDialog,
    coinFlipOverlay: dialogs.coinFlipOverlay,
    phaseChangeDialog: dialogs.phaseChangeDialog,
    startGame: () => startGame(),
    startReady: async (isRedraw) => {
      const gameId = gameContext.gameId;
      const playerId = gameContext.playerId;
      if (!gameId || !playerId) {
        console.warn("[startReady] missing gameId/playerId", { gameId, playerId });
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
        console.warn("[chooseFirstPlayer] missing gameId/playerId", { gameId, playerId });
        return;
      }
      await api.chooseFirstPlayer({ gameId, playerId, chosenFirstPlayerId });
      await engine.updateGameStatus(gameId, playerId);
    },
    resolveSlotOwnerByPlayer,
    getTargetAnchorProviders,
    getSlotsFromRaw: (data) => slotPresenter.toSlots(data, gameContext.playerId),
  });

  const { animationQueue, slotAnimationRender } = animationPipeline;

  animationQueue.setOnIdle(() => handleAnimationQueueIdle());
  animationQueue.setOnEventStart((event, ctx) => {
    const slots = slotAnimationRender.handleEventStart(
      event,
      slotPresenter.toSlots(ctx.currentRaw ?? ctx.previousRaw, gameContext.playerId),
    );
    if (slots) {
      renderSlots(slots);
    }
  });
  animationQueue.setOnEventEnd((event, ctx) => {
    const slots = slotAnimationRender.handleEventEnd(event, ctx);
    if (slots) {
      renderSlots(slots);
    }
    if (shouldRefreshHandForEvent(event)) {
      updateHandArea({ skipAnimation: true });
      controls.handControls?.scrollToEnd?.(true);
    }
  });

  return { animationQueue, slotAnimationRender };
}
