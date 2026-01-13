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
  const drawPopupDialog = new DrawPopupDialog(scene);
  const phaseChangeDialog = new PhaseChangeDialog(scene);
  const mulliganDialog = new MulliganDialog(scene, timerController);
  const chooseFirstPlayerDialog = new ChooseFirstPlayerDialog(scene, timerController);
  const turnOrderStatusDialog = new TurnOrderStatusDialog(scene);
  const coinFlipOverlay = new CoinFlipOverlay(scene);
  const waitingOpponentDialog = new TurnOrderStatusDialog(scene);
  const mulliganWaitingDialog = new TurnOrderStatusDialog(scene);

  dialogCoordinator.setWaitingOpponentDialog(waitingOpponentDialog);
  dialogCoordinator.setMulliganWaitingDialog(mulliganWaitingDialog);

  const pilotTargetDialog = new PilotTargetDialog(scene, createSlotSprite, timerController);
  const pilotDesignationDialog = new PilotDesignationDialog(scene, timerController);
  const effectTargetDialog = new EffectTargetDialog(scene, createSlotSprite, timerController);
  const trashAreaDialog = new TrashAreaDialog(scene);

  return {
    drawPopupDialog,
    phaseChangeDialog,
    mulliganDialog,
    chooseFirstPlayerDialog,
    turnOrderStatusDialog,
    coinFlipOverlay,
    waitingOpponentDialog,
    mulliganWaitingDialog,
    pilotTargetDialog,
    pilotDesignationDialog,
    effectTargetDialog,
    trashAreaDialog,
  };
}
