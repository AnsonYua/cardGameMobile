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

type CreateSlotSprite = (slot: unknown, size: number) => Phaser.GameObjects.GameObject | undefined;

export function setupBoardDialogs(
  scene: Phaser.Scene,
  dialogCoordinator: DialogCoordinator,
  createSlotSprite: CreateSlotSprite,
): BoardDialogSet {
  const drawPopupDialog = new DrawPopupDialog(scene);
  const phaseChangeDialog = new PhaseChangeDialog(scene);
  const mulliganDialog = new MulliganDialog(scene);
  const chooseFirstPlayerDialog = new ChooseFirstPlayerDialog(scene);
  const turnOrderStatusDialog = new TurnOrderStatusDialog(scene);
  const coinFlipOverlay = new CoinFlipOverlay(scene);
  const waitingOpponentDialog = new TurnOrderStatusDialog(scene);
  const mulliganWaitingDialog = new TurnOrderStatusDialog(scene);

  dialogCoordinator.setWaitingOpponentDialog(waitingOpponentDialog);
  dialogCoordinator.setMulliganWaitingDialog(mulliganWaitingDialog);

  const pilotTargetDialog = new PilotTargetDialog(scene, createSlotSprite);
  const pilotDesignationDialog = new PilotDesignationDialog(scene);
  const effectTargetDialog = new EffectTargetDialog(scene, createSlotSprite);
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
