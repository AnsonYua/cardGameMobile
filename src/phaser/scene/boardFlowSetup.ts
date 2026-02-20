import type Phaser from "phaser";
import type { ApiManager } from "../api/ApiManager";
import type { GameEngine } from "../game/GameEngine";
import type { GameContext } from "../game/GameContextStore";
import type { SlotPresenter } from "../ui/SlotPresenter";
import type { EffectTargetDialog } from "../ui/EffectTargetDialog";
import type { BurstChoiceDialog } from "../ui/BurstChoiceDialog";
import type { OptionChoiceDialog } from "../ui/OptionChoiceDialog";
import type { TokenChoiceDialog } from "../ui/TokenChoiceDialog";
import type { PromptChoiceDialog } from "../ui/PromptChoiceDialog";
import type { TutorTopDeckRevealDialog } from "../ui/TutorTopDeckRevealDialog";
import type { ActionControls } from "../controllers/ControllerTypes";
import { BurstChoiceFlowManager } from "../controllers/BurstChoiceFlowManager";
import { BurstChoiceGroupFlowManager } from "../controllers/BurstChoiceGroupFlowManager";
import { OptionChoiceFlowManager } from "../controllers/OptionChoiceFlowManager";
import { PromptChoiceFlowManager } from "../controllers/PromptChoiceFlowManager";
import { TokenChoiceFlowManager } from "../controllers/TokenChoiceFlowManager";
import { EffectTargetController } from "../controllers/EffectTargetController";
import type { BurstChoiceGroupDialog } from "../ui/BurstChoiceGroupDialog";

type BoardFlowSetupParams = {
  scene: Phaser.Scene;
  api: ApiManager;
  engine: GameEngine;
  gameContext: GameContext;
  slotPresenter: SlotPresenter;
  dialogs: {
    effectTargetDialog: EffectTargetDialog;
    burstChoiceDialog: BurstChoiceDialog;
    burstChoiceGroupDialog: BurstChoiceGroupDialog;
    optionChoiceDialog: OptionChoiceDialog;
    promptChoiceDialog: PromptChoiceDialog;
    tutorTopDeckRevealDialog: TutorTopDeckRevealDialog;
    tokenChoiceDialog: TokenChoiceDialog;
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

  const optionChoiceFlow = new OptionChoiceFlowManager({
    api: params.api,
    engine: params.engine,
    gameContext: params.gameContext,
    actionControls: params.actionControls,
    optionChoiceDialog: params.dialogs.optionChoiceDialog,
    refreshActions: params.onRefreshActions,
    onTimerPause: params.onTimerPause,
    onTimerResume: params.onTimerResume,
  });

  const promptChoiceFlow = new PromptChoiceFlowManager({
    api: params.api,
    engine: params.engine,
    gameContext: params.gameContext,
    actionControls: params.actionControls,
    promptChoiceDialog: params.dialogs.promptChoiceDialog,
    tutorTopDeckRevealDialog: params.dialogs.tutorTopDeckRevealDialog,
    refreshActions: params.onRefreshActions,
    onTimerPause: params.onTimerPause,
    onTimerResume: params.onTimerResume,
  });

  const burstGroupFlow = new BurstChoiceGroupFlowManager({
    api: params.api,
    engine: params.engine,
    gameContext: params.gameContext,
    actionControls: params.actionControls,
    groupDialog: params.dialogs.burstChoiceGroupDialog,
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

  const tokenChoiceFlow = new TokenChoiceFlowManager({
    api: params.api,
    engine: params.engine,
    gameContext: params.gameContext,
    actionControls: params.actionControls,
    tokenChoiceDialog: params.dialogs.tokenChoiceDialog,
    refreshActions: params.onRefreshActions,
    onTimerPause: params.onTimerPause,
    onTimerResume: params.onTimerResume,
  });

  return { burstFlow, burstGroupFlow, optionChoiceFlow, promptChoiceFlow, tokenChoiceFlow, effectTargetController };
}
