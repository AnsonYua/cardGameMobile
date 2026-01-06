import { ActionBarCoordinator } from "./ActionBarCoordinator";
import { ActionExecutor } from "./ActionExecutor";
import { ActionStepCoordinator } from "./ActionStepCoordinator";
import { ActionStepTriggerHandler } from "./ActionStepTriggerHandler";
import { AttackTargetCoordinator } from "./AttackTargetCoordinator";
import { BlockerFlowManager } from "./BlockerFlowManager";
import { OpponentResolver } from "./OpponentResolver";
import { SelectionHandler } from "./SelectionHandler";
import { SlotInteractionGate } from "./SlotInteractionGate";
import { TurnStateCoordinator } from "./TurnStateCoordinator";
import {
  SelectionActionController,
  type SelectionActionControllerDeps,
  type SelectionActionControllerModules,
} from "./SelectionActionController";

export function createSelectionActionController(deps: SelectionActionControllerDeps) {
  let controller: SelectionActionController;
  let selectionHandler: SelectionHandler;
  let actionExecutor: ActionExecutor;

  const getController = () => controller;

  const slotGate = new SlotInteractionGate(deps.slotControls ?? null);
  const attackCoordinator = new AttackTargetCoordinator(deps.actionControls ?? null);
  const blockerFlow = new BlockerFlowManager({
    api: deps.api,
    engine: deps.engine,
    gameContext: deps.gameContext,
    slotPresenter: deps.slotPresenter,
    actionControls: deps.actionControls,
    effectTargetController: deps.effectTargetController,
    refreshActions: () => getController()?.refreshActions("neutral"),
    slotGate,
  });
  const opponentResolver = new OpponentResolver({
    engine: deps.engine,
    slotPresenter: deps.slotPresenter,
    gameContext: deps.gameContext,
  });
  actionExecutor = new ActionExecutor({
    api: deps.api,
    engine: deps.engine,
    gameContext: deps.gameContext,
    attackCoordinator,
    getSelectedSlot: () => selectionHandler?.getSelectedSlot(),
    getOpponentRestedUnitSlots: () => opponentResolver.getOpponentRestedUnitSlots(),
    getOpponentPlayerId: () => opponentResolver.getOpponentPlayerId(),
    clearSelection: () => selectionHandler?.clearSelectionUI({ clearEngine: true }),
    refreshNeutral: () => getController()?.refreshActions("neutral"),
  });
  const actionStepTriggerHandler = new ActionStepTriggerHandler({
    getSelectedHandCard: () => selectionHandler?.getSelectedHandCard(),
    runActionThenRefresh: async (actionId, source) => {
      await getController()!.runActionThenRefresh(actionId, source);
    },
    cancelSelection: () => actionExecutor.cancelSelection(),
  });
  const actionStepCoordinator = new ActionStepCoordinator({
    engine: deps.engine,
    slotPresenter: deps.slotPresenter,
    gameContext: deps.gameContext,
    actionControls: deps.actionControls,
    callbacks: {
      onSkipAction: async () => {
        await actionExecutor.handleSkipAction();
      },
      onCancelSelection: () => {
        actionExecutor.cancelSelection();
      },
      onTriggerSelection: async (selection) => {
        await actionStepTriggerHandler.handleActionStepTrigger(selection);
      },
      onTriggerPilot: async (slot) => {
        await actionStepTriggerHandler.handlePilotEffectTrigger(slot);
      },
      onTriggerUnit: async (slot) => {
        await actionStepTriggerHandler.handleUnitEffectTrigger(slot);
      },
    },
  });
  selectionHandler = new SelectionHandler({
    engine: deps.engine,
    handControls: deps.handControls,
    slotControls: deps.slotControls,
    gameContext: deps.gameContext,
    blockerFlow,
    attackCoordinator,
    actionStepCoordinator,
    refreshActions: (source) => getController()?.refreshActions(source),
    showOverlay: deps.showOverlay,
  });
  const turnStateCoordinator = new TurnStateCoordinator({
    engine: deps.engine,
    gameContext: deps.gameContext,
    slotGate,
    blockerFlow,
  });
  const actionBarCoordinator = new ActionBarCoordinator({
    engine: deps.engine,
    handPresenter: deps.handPresenter,
    actionControls: deps.actionControls,
    handControls: deps.handControls,
    gameContext: deps.gameContext,
    actionStepCoordinator,
    attackCoordinator,
    blockerFlow,
    getSelection: () => deps.engine.getSelection(),
    getSelectedSlot: () => selectionHandler.getSelectedSlot(),
    getOpponentRestedUnitSlots: () => opponentResolver.getOpponentRestedUnitSlots(),
    onAttackUnit: async () => {
      await actionExecutor.handleAttackUnit();
    },
    onAttackShieldArea: async () => {
      await actionExecutor.handleAttackShieldArea();
    },
    onCancelSelection: () => {
      actionExecutor.cancelSelection();
    },
    onRefreshActions: (source) => {
      getController()?.refreshActions(source);
    },
    onSyncAndUpdateActionBar: (source) => {
      getController()?.syncAndUpdateActionBar(source);
    },
    buildActionDescriptors: (descriptors) => getController()!.buildActionDescriptors(descriptors),
  });

  const modules: SelectionActionControllerModules = {
    slotGate,
    attackCoordinator,
    blockerFlow,
    actionStepCoordinator,
    selectionHandler,
    opponentResolver,
    actionExecutor,
    actionStepTriggerHandler,
    turnStateCoordinator,
    actionBarCoordinator,
  };

  controller = new SelectionActionController(deps, modules);
  return controller;
}
