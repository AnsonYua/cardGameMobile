import type { GameContext } from "../game/GameContextStore";
import type { ActionControls } from "./ControllerTypes";
import type { SlotViewModel } from "../ui/SlotTypes";
import type { SlotPresenter } from "../ui/SlotPresenter";
import type { GameEngine } from "../game/GameEngine";
import {
  ActionTargetEntry,
  getActionTargetsForPlayer,
  getBattleFromRaw,
  getSlotBySelection,
  handCardMatchesActionTarget,
  selectionMatchesActionTarget,
  slotMatchesActionTarget,
} from "./ActionStepUtils";

export type ActionStepStatus = "awaiting" | "confirmed" | "none";

type ActionStepCallbacks = {
  onSkipAction: () => Promise<void>;
  onCancelSelection: () => void;
  onTriggerSelection: (selection: any) => Promise<void> | void;
  onTriggerPilot: (slot?: SlotViewModel) => Promise<void> | void;
  onTriggerUnit: (slot?: SlotViewModel) => Promise<void> | void;
};

export class ActionStepCoordinator {
  constructor(
    private deps: {
      engine: GameEngine;
      slotPresenter: SlotPresenter;
      gameContext: GameContext;
      actionControls?: ActionControls | null;
      callbacks: ActionStepCallbacks;
    },
  ) {}

  getStatus(raw?: any): ActionStepStatus {
    const snapshotRaw = raw ?? (this.deps.engine.getSnapshot().raw as any);
    const battle = snapshotRaw?.gameEnv?.currentBattle ?? snapshotRaw?.gameEnv?.currentbattle;
    const selfId = this.deps.gameContext.playerId;
    if (!battle || !selfId) return "none";
    const status = (battle.status || "").toString().toUpperCase();
    const confirmations = battle.confirmations || {};
    const confirmed = confirmations[selfId];
    if (status === "ACTION_STEP") {
      if (confirmed === false) return "awaiting";
      if (confirmed === true) return "confirmed";
    }
    return "none";
  }

  isInActionStep(raw?: any) {
    return this.getStatus(raw) !== "none";
  }

  getTargets(raw: any): ActionTargetEntry[] {
    const battle = getBattleFromRaw(raw);
    if (!battle) return [];
    return getActionTargetsForPlayer(battle, this.deps.gameContext.playerId);
  }

  isHandCardTarget(cardUid: string | undefined, raw: any) {
    return handCardMatchesActionTarget(cardUid, this.getTargets(raw));
  }

  isSlotTarget(slot: SlotViewModel, raw: any) {
    const battle = getBattleFromRaw(raw);
    if (!battle) return false;
    const targets = getActionTargetsForPlayer(battle, this.deps.gameContext.playerId);
    return slotMatchesActionTarget(slot, targets);
  }

  cardDataHasActionStepWindow(cardData: any) {
    const rules: any[] = Array.isArray(cardData?.effects?.rules) ? cardData.effects.rules : [];
    return rules.some((r) => {
      const wins: any[] = Array.isArray(r?.timing?.windows) ? r.timing.windows : [];
      return wins.some((w) => (w || "").toString().toUpperCase() === "ACTION_STEP");
    });
  }

  slotHasActionStepWindow(slot?: SlotViewModel) {
    if (!slot) return false;
    const unitHas = this.cardDataHasActionStepWindow(slot.unit?.cardData);
    const pilotHas = this.cardDataHasActionStepWindow(slot.pilot?.cardData);
    return unitHas || pilotHas;
  }

  applyActionBar(selection: any, status: ActionStepStatus) {
    const raw = this.deps.engine.getSnapshot().raw as any;
    if (status === "none") return false;
    const battle = getBattleFromRaw(raw);
    if (!battle) return false;
    const targets = getActionTargetsForPlayer(battle, this.deps.gameContext.playerId);
    const actions = this.deps.actionControls;
    if (!actions) return false;

    if (status === "confirmed") {
      actions.setWaitingForOpponent?.(true);
      actions.setState?.({ descriptors: [] });
      return true;
    }

    actions.setWaitingForOpponent?.(false);
    const matchesTarget = selectionMatchesActionTarget(
      selection,
      targets,
      raw,
      this.deps.slotPresenter,
      this.deps.gameContext.playerId,
    );
    if (matchesTarget) {
      const descriptors = this.buildDescriptorsForSelection(selection, targets);
      actions.setState?.({ descriptors });
    } else {
      actions.setState?.({
        descriptors: [
          {
            label: "Skip Action-Step",
            enabled: true,
            primary: true,
            onClick: async () => {
              await this.deps.callbacks.onSkipAction();
            },
          },
        ],
      });
    }
    return true;
  }

  private buildDescriptorsForSelection(selection: any, targets: ActionTargetEntry[]) {
    const descriptors: Array<{ label: string; enabled?: boolean; primary?: boolean; onClick?: () => Promise<void> | void }> = [];
    const raw = this.deps.engine.getSnapshot().raw as any;
    if (
      !selection ||
      !selectionMatchesActionTarget(selection, targets, raw, this.deps.slotPresenter, this.deps.gameContext.playerId)
    )
      return descriptors;
    if (selection.kind === "hand") {
      descriptors.push({
        label: "Trigger Card Effect",
        primary: true,
        enabled: true,
        onClick: async () => {
          await this.deps.callbacks.onTriggerSelection(selection);
        },
      });
    } else if (selection.kind === "slot") {
      const slot = getSlotBySelection(selection, raw, this.deps.slotPresenter, this.deps.gameContext.playerId);
      const pilotHasEffect = this.cardDataHasActionStepWindow(slot?.pilot?.cardData);
      const unitHasEffect = this.cardDataHasActionStepWindow(slot?.unit?.cardData);
      if (pilotHasEffect) {
        descriptors.push({
          label: "Trigger Pilot Effect",
          enabled: true,
          primary: true,
          onClick: async () => {
            await this.deps.callbacks.onTriggerPilot(slot);
          },
        });
      }
      if (unitHasEffect) {
        descriptors.push({
          label: "Trigger Unit Effect",
          enabled: true,
          primary: pilotHasEffect ? false : true,
          onClick: async () => {
            await this.deps.callbacks.onTriggerUnit(slot);
          },
        });
      }
      if (!pilotHasEffect && !unitHasEffect) {
        descriptors.push({
          label: "Trigger Card Effect",
          enabled: true,
          primary: true,
          onClick: async () => {
            await this.deps.callbacks.onTriggerSelection(selection);
          },
        });
      }
    } else {
      descriptors.push({
        label: "Trigger Card Effect",
        primary: true,
        enabled: true,
        onClick: async () => {
          await this.deps.callbacks.onTriggerSelection(selection);
        },
      });
    }
    descriptors.push({
      label: "Cancel",
      enabled: true,
      onClick: () => {
        this.deps.callbacks.onCancelSelection();
      },
    });
    return descriptors;
  }
}
