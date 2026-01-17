import type Phaser from "phaser";
import type { ApiManager } from "../api/ApiManager";
import type { GameEngine } from "../game/GameEngine";
import type { GameContext } from "../game/GameContextStore";
import type { SlotPresenter } from "../ui/SlotPresenter";
import type { EffectTargetDialog } from "../ui/EffectTargetDialog";
import type { BurstChoiceDialog } from "../ui/BurstChoiceDialog";
import type { ActionControls } from "../controllers/ControllerTypes";
import { BurstChoiceFlowManager } from "../controllers/BurstChoiceFlowManager";
import { EffectTargetController } from "../controllers/EffectTargetController";

type BoardFlowSetupParams = {
  scene: Phaser.Scene;
  api: ApiManager;
  engine: GameEngine;
  gameContext: GameContext;
  slotPresenter: SlotPresenter;
  dialogs: {
    effectTargetDialog: EffectTargetDialog;
    burstChoiceDialog: BurstChoiceDialog;
  };
  actionControls?: ActionControls | null;
  getSlotAreaCenter?: (owner: "player" | "opponent") => { x: number; y: number } | undefined;
  onRefreshActions: () => void;
  onPlayerAction?: () => void;
  onTimerPause?: () => void;
  onTimerResume?: () => void;
};

export function setupBoardFlows(params: BoardFlowSetupParams) {
  const burstFlow = new BurstChoiceFlowManager({
    api: params.api,
    engine: params.engine,
    gameContext: params.gameContext,
    actionControls: params.actionControls,
    burstChoiceDialog: params.dialogs.burstChoiceDialog,
    refreshActions: params.onRefreshActions,
    onTimerPause: params.onTimerPause,
    onTimerResume: params.onTimerResume,
  });

  const effectTargetController = new EffectTargetController({
    dialog: params.dialogs.effectTargetDialog,
    slotPresenter: params.slotPresenter,
    gameContext: params.gameContext,
    engine: params.engine,
    api: params.api,
    scene: params.scene,
    onPlayerAction: params.onPlayerAction,
    getSlotAreaCenter: params.getSlotAreaCenter,
  });

  return { burstFlow, effectTargetController };
}
