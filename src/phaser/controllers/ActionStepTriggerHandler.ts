import type { HandCardView } from "../ui/HandTypes";
import type { SlotViewModel } from "../ui/SlotTypes";
import type { GameContext } from "../game/GameContextStore";
import type { GameEngine } from "../game/GameEngine";
import type { ActionTargetEntry } from "./ActionStepUtils";
import type { ActionExecutor } from "./ActionExecutor";
import type { AbilityActivationFlowController } from "./AbilityActivationFlowController";
import {
  getActionStepActivatedEffectOptionsForSlotCard,
  getSingleEnabledActionStepEffectOption,
} from "./ActionStepEffectOptions";

export class ActionStepTriggerHandler {
  constructor(
    private deps: {
      getSelectedHandCard: () => HandCardView | undefined;
      engine: GameEngine;
      gameContext: GameContext;
      actionExecutor: ActionExecutor;
      getActionStepTargets: (raw: any) => ActionTargetEntry[];
      getAbilityFlow: () => AbilityActivationFlowController | undefined;
      runActionThenRefresh: (actionId: string, source: "hand" | "slot" | "base" | "neutral") => Promise<void>;
      cancelSelection: () => void;
    },
  ) {}

  async handleActionStepTrigger(selection: any) {
    if (!selection) {
      return;
    }
    if (selection.kind === "hand") {
      const cardType = (this.deps.getSelectedHandCard()?.cardType || "").toLowerCase();
      if (cardType === "command") {
        await this.deps.runActionThenRefresh("playCommandFromHand", "hand");
        return;
      }
      return;
    }
    if (selection.kind === "slot") {
      this.deps.cancelSelection();
      return;
    }
    if (selection.kind === "base") {
      this.deps.cancelSelection();
    }
  }

  async handlePilotEffectTrigger(slot?: SlotViewModel) {
    await this.handleSlotCardEffectTrigger(slot, "pilot");
  }

  async handleUnitEffectTrigger(slot?: SlotViewModel) {
    await this.handleSlotCardEffectTrigger(slot, "unit");
  }

  private async handleSlotCardEffectTrigger(slot: SlotViewModel | undefined, cardKind: "unit" | "pilot") {
    const raw = this.deps.engine.getSnapshot().raw as any;
    const playerId = this.deps.gameContext.playerId;
    if (!slot || slot.owner !== "player" || !raw || !playerId) {
      this.deps.cancelSelection();
      return;
    }

    const targets = this.deps.getActionStepTargets(raw);
    const resolved = getActionStepActivatedEffectOptionsForSlotCard({
      slot,
      cardKind,
      raw,
      playerId,
      targets,
    });

    if (!resolved.carduid || !resolved.options.length) {
      this.deps.cancelSelection();
      return;
    }

    const singleEnabledOption = getSingleEnabledActionStepEffectOption(resolved);
    if (singleEnabledOption) {
      await this.deps.actionExecutor.handleActivateCardAbility(resolved.carduid, singleEnabledOption.effectId);
      return;
    }

    const abilityFlow = this.deps.getAbilityFlow();
    if (abilityFlow) {
      await abilityFlow.showSlotCardAbilityChoiceDialog({
        slot,
        cardKind,
        raw,
        allowedEffectIds: resolved.allowedEffectIds.length
          ? resolved.allowedEffectIds
          : resolved.options.map((opt) => opt.effectId),
      });
      return;
    }

    await this.deps.actionExecutor.handleActivateCardAbility(resolved.carduid, resolved.options[0].effectId);
  }
}
