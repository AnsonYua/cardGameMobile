import type { ActionSource, GameStatusSnapshot } from "../game/GameEngine";
import type { ActionDescriptor } from "../game/ActionRegistry";
import type { HandPresenter } from "../ui/HandPresenter";
import type { SelectionActionController } from "../controllers/SelectionActionController";
import type { EffectTargetDialog } from "../ui/EffectTargetDialog";
import type { PilotTargetDialog } from "../ui/PilotTargetDialog";
import type { PilotFlowController } from "../controllers/PilotFlowController";

type TestHookDeps = {
  engineSnapshot: () => GameStatusSnapshot;
  engineGetAvailableActions: (source: ActionSource) => ActionDescriptor[];
  handPresenter: HandPresenter;
  playerId: string;
  selectionAction?: SelectionActionController;
  runActionThenRefresh: (id: string, source: ActionSource) => Promise<void>;
  effectTargetDialog?: EffectTargetDialog;
  pilotTargetDialog?: PilotTargetDialog;
  pilotFlow?: PilotFlowController;
};

export function buildBoardSceneTestHooks(deps: TestHookDeps) {
  const selectHandCard = (uid?: string) => {
    if (!uid) return false;
    const snapshot = deps.engineSnapshot();
    const raw = snapshot.raw as any;
    if (!raw) return false;
    const cards = deps.handPresenter.toHandCards(raw, deps.playerId);
    const target = cards.find((c) => c.uid === uid);
    if (!target) return false;
    deps.selectionAction?.handleHandCardSelected(target);
    return true;
  };
  const clickPrimaryAction = async (source: ActionSource = "hand") => {
    const actions = deps.engineGetAvailableActions(source);
    const primary = actions.find((a) => a.primary) || actions[0];
    if (!primary) return false;
    await deps.runActionThenRefresh(primary.id, source);
    return true;
  };
  const runAction = async (id: string, source: ActionSource = "neutral") => {
    await deps.runActionThenRefresh(id, source);
    return true;
  };
  const selectEffectTarget = async (targetIndex = 0) => {
    const selected = await deps.effectTargetDialog?.selectTarget(targetIndex);
    if (selected) {
      await deps.effectTargetDialog?.hide();
      return true;
    }
    return false;
  };
  const selectPilotTarget = async (targetIndex = 0) => {
    const selectedInDialog = await deps.pilotTargetDialog?.selectTarget(targetIndex);
    if (selectedInDialog) {
      await deps.pilotTargetDialog?.hide();
      return true;
    }
    return false;
  };
  const choosePilotDesignationPilot = async () => {
    deps.pilotFlow?.showPilotTargetDialog("playPilotDesignationAsPilot");
    return true;
  };
  const choosePilotDesignationCommand = async () => {
    await deps.runActionThenRefresh("playPilotDesignationAsCommand", "neutral");
    return true;
  };
  return {
    selectHandCard,
    clickPrimaryAction,
    runAction,
    selectEffectTarget,
    selectPilotTarget,
    choosePilotDesignationPilot,
    choosePilotDesignationCommand,
  };
}
