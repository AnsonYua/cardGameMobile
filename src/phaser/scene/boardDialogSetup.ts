import Phaser from "phaser";
import { DialogCoordinator } from "../controllers/DialogCoordinator";
import { createCoreDialogs, createStatusDialogs, createTimedDialogs } from "./dialogFactories";
import type { SlotViewModel } from "../ui/SlotTypes";
import type { TurnTimerController } from "../controllers/TurnTimerController";
import type { BurstChoiceDialog } from "../ui/BurstChoiceDialog";
import type { BurstChoiceGroupDialog } from "../ui/BurstChoiceGroupDialog";
import type { DrawPopupDialog } from "../ui/DrawPopupDialog";
import type { PhaseChangeDialog } from "../ui/PhaseChangeDialog";
import type { MulliganDialog } from "../ui/MulliganDialog";
import type { ChooseFirstPlayerDialog } from "../ui/ChooseFirstPlayerDialog";
import type { TurnOrderStatusDialog } from "../ui/TurnOrderStatusDialog";
import type { CoinFlipOverlay } from "../ui/CoinFlipOverlay";
import type { PilotTargetDialog } from "../ui/PilotTargetDialog";
import type { PilotDesignationDialog } from "../ui/PilotDesignationDialog";
import type { EffectTargetDialog } from "../ui/EffectTargetDialog";
import type { TrashAreaDialog } from "../ui/TrashAreaDialog";

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
  topDeckSelectionReviewDialog: import("../ui/TopDeckSelectionReviewDialog").TopDeckSelectionReviewDialog;
  tokenChoiceDialog: import("../ui/TokenChoiceDialog").TokenChoiceDialog;
  gameOverDialog: import("../ui/GameOverDialog").GameOverDialog;
  targetNoticeDialog: import("../ui/TargetNoticeDialog").TargetNoticeDialog;
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
    topDeckSelectionReviewDialog: timedDialogs.topDeckSelectionReviewDialog,
    tokenChoiceDialog: timedDialogs.tokenChoiceDialog,
    gameOverDialog: coreDialogs.gameOverDialog,
    targetNoticeDialog: coreDialogs.targetNoticeDialog,
  };
}
