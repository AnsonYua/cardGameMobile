import { ActionBarCoordinator } from "./ActionBarCoordinator";
import { ActionExecutor } from "./ActionExecutor";
import { ActionStepCoordinator } from "./ActionStepCoordinator";
import { ActionStepTriggerHandler } from "./ActionStepTriggerHandler";
import { AttackTargetCoordinator } from "./AttackTargetCoordinator";
import { AbilityActivationFlowController } from "./AbilityActivationFlowController";
import { BlockerFlowManager } from "./BlockerFlowManager";
import { BurstChoiceFlowManager } from "./BurstChoiceFlowManager";
import { BurstChoiceGroupFlowManager } from "./BurstChoiceGroupFlowManager";
import { OptionChoiceFlowManager } from "./OptionChoiceFlowManager";
import { PromptChoiceFlowManager } from "./PromptChoiceFlowManager";
import { TokenChoiceFlowManager } from "./TokenChoiceFlowManager";
import { OpponentResolver } from "./OpponentResolver";
import { SelectionHandler } from "./SelectionHandler";
import { SlotInteractionGate } from "./SlotInteractionGate";
import { TurnStateCoordinator } from "./TurnStateCoordinator";
import {
  SelectionActionController,
  type SelectionActionControllerDeps,
  type SelectionActionControllerModules,
} from "./SelectionActionController";
import { showActionError } from "./ActionErrorUtils";

export function createSelectionActionController(deps: SelectionActionControllerDeps) {
  let controller: SelectionActionController;
  let selectionHandler: SelectionHandler;
  let actionExecutor: ActionExecutor;

  const reportActionError = (err: any) => showActionError(deps.errorDialog, err);

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
    onPlayerAction: deps.onPlayerAction,
  });
  const burstFlow =
    deps.burstFlow ??
    new BurstChoiceFlowManager({
      api: deps.api,
      engine: deps.engine,
      gameContext: deps.gameContext,
      actionControls: deps.actionControls,
      burstChoiceDialog: deps.burstChoiceDialog,
      refreshActions: () => getController()?.refreshActions("neutral"),
      onTimerPause: deps.onTimerPause,
      onTimerResume: deps.onTimerResume,
    });
  const burstGroupFlow =
    deps.burstGroupFlow ??
    new BurstChoiceGroupFlowManager({
      api: deps.api,
      engine: deps.engine,
      gameContext: deps.gameContext,
      actionControls: deps.actionControls,
      groupDialog: null,
      burstChoiceDialog: deps.burstChoiceDialog,
      refreshActions: () => getController()?.refreshActions("neutral"),
      onTimerPause: deps.onTimerPause,
      onTimerResume: deps.onTimerResume,
    });
  const optionChoiceFlow =
    deps.optionChoiceFlow ??
    new OptionChoiceFlowManager({
      api: deps.api,
      engine: deps.engine,
      gameContext: deps.gameContext,
      actionControls: deps.actionControls,
      optionChoiceDialog: deps.optionChoiceDialog,
      refreshActions: () => getController()?.refreshActions("neutral"),
      onTimerPause: deps.onTimerPause,
      onTimerResume: deps.onTimerResume,
    });
  const promptChoiceFlow =
    deps.promptChoiceFlow ??
    new PromptChoiceFlowManager({
      api: deps.api,
      engine: deps.engine,
      gameContext: deps.gameContext,
      actionControls: deps.actionControls,
      promptChoiceDialog: deps.promptChoiceDialog,
      tutorTopDeckRevealDialog: deps.tutorTopDeckRevealDialog,
      refreshActions: () => getController()?.refreshActions("neutral"),
      onTimerPause: deps.onTimerPause,
      onTimerResume: deps.onTimerResume,
    });
  const tokenChoiceFlow =
    deps.tokenChoiceFlow ??
    new TokenChoiceFlowManager({
      api: deps.api,
      engine: deps.engine,
      gameContext: deps.gameContext,
      actionControls: deps.actionControls,
      tokenChoiceDialog: deps.tokenChoiceDialog,
      refreshActions: () => getController()?.refreshActions("neutral"),
      onTimerPause: deps.onTimerPause,
      onTimerResume: deps.onTimerResume,
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
    getOpponentUnitSlots: () => opponentResolver.getOpponentUnitSlots(),
    getOpponentPlayerId: () => opponentResolver.getOpponentPlayerId(),
    clearSelection: () => selectionHandler?.clearSelectionUI({ clearEngine: true }),
    refreshNeutral: () => getController()?.refreshActions("neutral"),
    reportError: reportActionError,
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
        deps.onPlayerAction?.("skipAction");
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
      onActivateEffect: async () => {
        await getController()!.runActionThenRefresh("activateEffect", "slot");
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
    burstGroupFlow,
    burstFlow,
    optionChoiceFlow,
    promptChoiceFlow,
    tokenChoiceFlow,
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
    burstGroupFlow,
    burstFlow,
    optionChoiceFlow,
    promptChoiceFlow,
    tokenChoiceFlow,
    getSelection: () => deps.engine.getSelection(),
    getSelectedSlot: () => selectionHandler.getSelectedSlot(),
    getOpponentUnitSlots: () => opponentResolver.getOpponentUnitSlots(),
    onRefreshActions: (source) => {
      getController()?.refreshActions(source);
    },
    onSyncAndUpdateActionBar: (source) => {
      getController()?.syncAndUpdateActionBar(source);
    },
    buildActionDescriptors: (descriptors) => getController()!.buildActionDescriptors(descriptors),
  });

  const abilityFlow = new AbilityActivationFlowController({
    engine: deps.engine,
    gameContext: deps.gameContext,
    abilityChoiceDialog: deps.abilityChoiceDialog,
    actionExecutor,
  });

  const modules: SelectionActionControllerModules = {
    slotGate,
    attackCoordinator,
    blockerFlow,
    burstGroupFlow,
    burstFlow,
    optionChoiceFlow,
    promptChoiceFlow,
    tokenChoiceFlow,
    actionStepCoordinator,
    abilityFlow,
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
