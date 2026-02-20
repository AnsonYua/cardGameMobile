import Phaser from "phaser";
import { DialogCoordinator } from "../controllers/DialogCoordinator";
import { createCoreDialogs, createStatusDialogs, createTimedDialogs } from "./dialogFactories";
import type { SlotViewModel } from "../ui/SlotTypes";
import type { TurnTimerController } from "../controllers/TurnTimerController";
import type { BurstChoiceDialog } from "../ui/BurstChoiceDialog";
import type { BurstChoiceGroupDialog } from "../ui/BurstChoiceGroupDialog";

export type BoardDialogSet = {
  drawPopupDialog: DrawPopupDialog;
  phaseChangeDialog: PhaseChangeDialog;
  mulliganDialog: MulliganDialog;
  chooseFirstPlayerDialog: ChooseFirstPlayerDialog;
  turnOrderStatusDialog: TurnOrderStatusDialog;
  coinFlipOverlay: CoinFlipOverlay;
  waitingOpponentDialog: TurnOrderStatusDialog;
  mulliganWaitingDialog: TurnOrderStatusDialog;
  pilotTargetDialog: PilotTargetDialog;
  pilotDesignationDialog: PilotDesignationDialog;
  abilityChoiceDialog: import("../ui/AbilityChoiceDialog").AbilityChoiceDialog;
  effectTargetDialog: EffectTargetDialog;
  trashAreaDialog: TrashAreaDialog;
  errorDialog: import("../ui/ErrorDialog").ErrorDialog;
  burstChoiceDialog: BurstChoiceDialog;
  burstChoiceGroupDialog: BurstChoiceGroupDialog;
  optionChoiceDialog: import("../ui/OptionChoiceDialog").OptionChoiceDialog;
  promptChoiceDialog: import("../ui/PromptChoiceDialog").PromptChoiceDialog;
  tutorTopDeckRevealDialog: import("../ui/TutorTopDeckRevealDialog").TutorTopDeckRevealDialog;
  tokenChoiceDialog: import("../ui/TokenChoiceDialog").TokenChoiceDialog;
  gameOverDialog: import("../ui/GameOverDialog").GameOverDialog;
};

type CreateSlotSprite = (
  slot: SlotViewModel,
  size: { w: number; h: number },
) => Phaser.GameObjects.Container | undefined;

export function setupBoardDialogs(
  scene: Phaser.Scene,
  dialogCoordinator: DialogCoordinator,
  createSlotSprite: CreateSlotSprite,
  timerController?: TurnTimerController,
): BoardDialogSet {
  const coreDialogs = createCoreDialogs(scene);
  const statusDialogs = createStatusDialogs(scene, dialogCoordinator);
  const timedDialogs = createTimedDialogs(scene, createSlotSprite, timerController);

  return {
    drawPopupDialog: coreDialogs.drawPopupDialog,
    phaseChangeDialog: coreDialogs.phaseChangeDialog,
    mulliganDialog: timedDialogs.mulliganDialog,
    chooseFirstPlayerDialog: timedDialogs.chooseFirstPlayerDialog,
    turnOrderStatusDialog: statusDialogs.turnOrderStatusDialog,
    coinFlipOverlay: coreDialogs.coinFlipOverlay,
    waitingOpponentDialog: statusDialogs.waitingOpponentDialog,
    mulliganWaitingDialog: statusDialogs.mulliganWaitingDialog,
    pilotTargetDialog: timedDialogs.pilotTargetDialog,
    pilotDesignationDialog: timedDialogs.pilotDesignationDialog,
    abilityChoiceDialog: timedDialogs.abilityChoiceDialog,
    effectTargetDialog: timedDialogs.effectTargetDialog,
    trashAreaDialog: coreDialogs.trashAreaDialog,
    errorDialog: coreDialogs.errorDialog,
    burstChoiceDialog: timedDialogs.burstChoiceDialog,
    burstChoiceGroupDialog: timedDialogs.burstChoiceGroupDialog,
    optionChoiceDialog: timedDialogs.optionChoiceDialog,
    promptChoiceDialog: timedDialogs.promptChoiceDialog,
    tutorTopDeckRevealDialog: timedDialogs.tutorTopDeckRevealDialog,
    tokenChoiceDialog: timedDialogs.tokenChoiceDialog,
    gameOverDialog: coreDialogs.gameOverDialog,
  };
}
