import { findBaseCard } from "../utils/CardLookup";
import type { GameContext } from "../game/GameContextStore";
import type { GameEngine } from "../game/GameEngine";
import { getActivatedEffectOptions, getSlotCards } from "../game/actionEligibility";
import type { AbilityChoiceDialog, AbilityChoiceDialogGroup, AbilityChoiceDialogOption } from "../ui/AbilityChoiceDialog";
import type { ActionExecutor } from "./ActionExecutor";

function resolveCardUid(card: any): string | undefined {
  return (
    card?.carduid ??
    card?.cardUid ??
    card?.uid ??
    card?.id ??
    card?.cardId ??
    undefined
  );
}

export class AbilityActivationFlowController {
  constructor(
    private deps: {
      engine: GameEngine;
      gameContext: GameContext;
      abilityChoiceDialog?: AbilityChoiceDialog | null;
      actionExecutor: ActionExecutor;
    },
  ) {}

  async showAbilityChoiceDialog(input?: { raw?: any; selection?: any }) {
    const dialog = this.deps.abilityChoiceDialog;
    if (!dialog) return;

    const raw: any = input?.raw ?? this.deps.engine.getSnapshot().raw;
    const selection: any = input?.selection ?? this.deps.engine.getSelection();
    const playerId = this.deps.gameContext.playerId;
    if (!raw || !playerId || !selection) return;

    const groups: AbilityChoiceDialogGroup[] = [];
    if (selection.kind === "base") {
      if (selection.side !== "player") return;
      const baseCard = findBaseCard(raw, playerId);
      const carduid = resolveCardUid(baseCard);
      if (!carduid) return;
      const options = getActivatedEffectOptions(baseCard, raw, playerId);
      const mapped = this.mapOptions("Base", carduid, options);
      if (mapped.length) {
        groups.push({ options: mapped });
      }
    } else if (selection.kind === "slot") {
      if (selection.owner !== "player") return;
      const slot = getSlotCards(selection, raw, playerId);
      const unitUid = resolveCardUid(slot?.unit);
      const pilotUid = resolveCardUid(slot?.pilot);
      const flatOptions: AbilityChoiceDialogOption[] = [];
      if (slot?.unit && unitUid) {
        const unitOptions = getActivatedEffectOptions(slot.unit, raw, playerId);
        flatOptions.push(...this.mapOptions("Unit", unitUid, unitOptions));
      }
      if (slot?.pilot && pilotUid) {
        const pilotOptions = getActivatedEffectOptions(slot.pilot, raw, playerId);
        flatOptions.push(...this.mapOptions("Pilot", pilotUid, pilotOptions));
      }
      if (flatOptions.length) {
        groups.push({ options: flatOptions });
      }
    }

    if (!groups.length) return;

    dialog.show({
      headerText: "Activate Effect",
      promptText: "",
      groups,
    });
  }

  private mapOptions(
    sourceLabel: string,
    carduid: string,
    options: Array<{ effectId: string; enabled: boolean; requiredEnergy: number; availableEnergy?: number; alreadyUsed?: boolean }>,
  ): AbilityChoiceDialogOption[] {
    const multiple = options.length > 1;
    return options.map((opt, idx) => {
      const baseLabel = multiple ? `Activate ${sourceLabel} Effect ${idx + 1}` : `Activate ${sourceLabel} Effect`;
      const costSuffix = opt.requiredEnergy ? ` (Cost ${opt.requiredEnergy})` : "";
      return {
        label: `${baseLabel}${costSuffix}`,
        enabled: true,
        onClick: async () => {
          if (!opt.enabled) {
            const available = Number(opt.availableEnergy ?? NaN);
            const hasNumbers = Number.isFinite(available) && Number.isFinite(opt.requiredEnergy);
            const costMessage =
              hasNumbers && available < opt.requiredEnergy
                ? `Not enough energy (need ${opt.requiredEnergy}, have ${available}).`
                : opt.alreadyUsed
                  ? "Already used this turn."
                  : opt.requiredEnergy
                    ? `Not enough energy to pay cost (${opt.requiredEnergy}).`
                    : "Not enough cost.";
            this.deps.abilityChoiceDialog?.showInfo({
              headerText: "Cannot Activate",
              message: costMessage,
            });
            return;
          }
          await this.deps.abilityChoiceDialog?.hide();
          await this.deps.actionExecutor.handleActivateCardAbility(carduid, opt.effectId);
        },
      };
    });
  }
}
