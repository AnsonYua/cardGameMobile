import Phaser from "phaser";
import { DialogCoordinator } from "../controllers/DialogCoordinator";
import { createCoreDialogs, createStatusDialogs, createTimedDialogs } from "./dialogFactories";
import type { SlotViewModel } from "../ui/SlotTypes";
import type { TurnTimerController } from "../controllers/TurnTimerController";
import type { BurstChoiceDialog } from "../ui/BurstChoiceDialog";

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
  effectTargetDialog: EffectTargetDialog;
  trashAreaDialog: TrashAreaDialog;
  burstChoiceDialog: BurstChoiceDialog;
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
    effectTargetDialog: timedDialogs.effectTargetDialog,
    trashAreaDialog: coreDialogs.trashAreaDialog,
    burstChoiceDialog: timedDialogs.burstChoiceDialog,
    gameOverDialog: coreDialogs.gameOverDialog,
  };
}
