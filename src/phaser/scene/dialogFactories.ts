import Phaser from "phaser";
import { DialogCoordinator } from "../controllers/DialogCoordinator";
import { DrawPopupDialog } from "../ui/DrawPopupDialog";
import { PhaseChangeDialog } from "../ui/PhaseChangeDialog";
import { MulliganDialog } from "../ui/MulliganDialog";
import { ChooseFirstPlayerDialog } from "../ui/ChooseFirstPlayerDialog";
import { TurnOrderStatusDialog } from "../ui/TurnOrderStatusDialog";
import { CoinFlipOverlay } from "../ui/CoinFlipOverlay";
import { PilotTargetDialog } from "../ui/PilotTargetDialog";
import { PilotDesignationDialog } from "../ui/PilotDesignationDialog";
import { EffectTargetDialog } from "../ui/EffectTargetDialog";
import { TrashAreaDialog } from "../ui/TrashAreaDialog";
import type { SlotViewModel } from "../ui/SlotTypes";
import type { TurnTimerController } from "../controllers/TurnTimerController";

type CreateSlotSprite = (
  slot: SlotViewModel,
  size: { w: number; h: number },
) => Phaser.GameObjects.Container | undefined;

export function createCoreDialogs(scene: Phaser.Scene) {
  return {
    drawPopupDialog: new DrawPopupDialog(scene),
    phaseChangeDialog: new PhaseChangeDialog(scene),
    coinFlipOverlay: new CoinFlipOverlay(scene),
    trashAreaDialog: new TrashAreaDialog(scene),
  };
}

export function createStatusDialogs(scene: Phaser.Scene, dialogCoordinator: DialogCoordinator) {
  const makeStatusDialog = () => new TurnOrderStatusDialog(scene);
  const turnOrderStatusDialog = makeStatusDialog();
  const waitingOpponentDialog = makeStatusDialog();
  const mulliganWaitingDialog = makeStatusDialog();

  dialogCoordinator.setWaitingOpponentDialog(waitingOpponentDialog);
  dialogCoordinator.setMulliganWaitingDialog(mulliganWaitingDialog);

  return {
    turnOrderStatusDialog,
    waitingOpponentDialog,
    mulliganWaitingDialog,
  };
}

export function createTimedDialogs(
  scene: Phaser.Scene,
  createSlotSprite: CreateSlotSprite,
  timerController?: TurnTimerController,
) {
  return {
    mulliganDialog: new MulliganDialog(scene, timerController),
    chooseFirstPlayerDialog: new ChooseFirstPlayerDialog(scene, timerController),
    pilotTargetDialog: new PilotTargetDialog(scene, createSlotSprite, timerController),
    pilotDesignationDialog: new PilotDesignationDialog(scene, timerController),
    effectTargetDialog: new EffectTargetDialog(scene, createSlotSprite, timerController),
  };
}
