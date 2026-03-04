import { findBaseCard } from "../utils/CardLookup";
import { resolveCardUid } from "../utils/CardUid";
import type { GameContext } from "../game/GameContextStore";
import type { GameEngine } from "../game/GameEngine";
import { getActivatedEffectOptions, getSlotCards } from "../game/actionEligibility";
import type { SlotViewModel } from "../ui/SlotTypes";
import type { AbilityChoiceDialog, AbilityChoiceDialogGroup, AbilityChoiceDialogOption } from "../ui/AbilityChoiceDialog";
import type { ActionExecutor } from "./ActionExecutor";

export class AbilityActivationFlowController {
  constructor(
    private deps: {
      engine: GameEngine;
      gameContext: GameContext;
      abilityChoiceDialog?: AbilityChoiceDialog | null;
      actionExecutor: ActionExecutor;
    },
  ) {}

  async showAbilityChoiceDialog(input?: { raw?: any; selection?: any; allowedEffectIdsByCarduid?: Record<string, string[]> }) {
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
      const options = this.filterOptionsByAllowed(carduid, getActivatedEffectOptions(baseCard, raw, playerId), input?.allowedEffectIdsByCarduid);
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
        const unitOptions = this.filterOptionsByAllowed(unitUid, getActivatedEffectOptions(slot.unit, raw, playerId), input?.allowedEffectIdsByCarduid);
        flatOptions.push(...this.mapOptions("Unit", unitUid, unitOptions));
      }
      if (slot?.pilot && pilotUid) {
        const pilotOptions = this.filterOptionsByAllowed(
          pilotUid,
          getActivatedEffectOptions(slot.pilot, raw, playerId),
          input?.allowedEffectIdsByCarduid,
        );
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

  async showSlotCardAbilityChoiceDialog(input: {
    slot?: SlotViewModel;
    cardKind: "unit" | "pilot";
    raw?: any;
    allowedEffectIds?: string[];
  }) {
    const slot = input.slot;
    const cardUid = (slot?.[input.cardKind]?.cardUid ?? "").toString();
    if (!slot || slot.owner !== "player" || !slot.slotId || !cardUid) return;
    await this.showAbilityChoiceDialog({
      raw: input.raw,
      selection: { kind: "slot", owner: "player", slotId: slot.slotId },
      allowedEffectIdsByCarduid: {
        [cardUid]: Array.isArray(input.allowedEffectIds) ? input.allowedEffectIds : [],
      },
    });
  }

  private filterOptionsByAllowed(
    carduid: string,
    options: Array<{ effectId: string }>,
    allowedByCarduid?: Record<string, string[]>,
  ) {
    if (!allowedByCarduid) return options;
    const keys = Object.keys(allowedByCarduid);
    if (!keys.length) return options;
    const allowedRaw = allowedByCarduid[carduid];
    if (!Array.isArray(allowedRaw)) return [];
    const allowed = new Set(allowedRaw.filter((id): id is string => typeof id === "string" && id.trim().length > 0));
    if (!allowed.size) return [];
    return options.filter((opt) => allowed.has(opt.effectId));
  }

  private mapOptions(
    sourceLabel: string,
    carduid: string,
    options: Array<{
      effectId: string;
      enabled: boolean;
      requiredEnergy: number;
      availableEnergy?: number;
      alreadyUsed?: boolean;
      conditionsMet?: boolean;
    }>,
  ): AbilityChoiceDialogOption[] {
    const multiple = options.length > 1;
    return options.map((opt, idx) => {
      const baseLabel = multiple ? `Activate ${sourceLabel} Effect ${idx + 1}` : `Activate ${sourceLabel} Effect`;
      const costSuffix = opt.requiredEnergy ? ` (Cost ${opt.requiredEnergy})` : "";
      return {
        label: `${baseLabel}${costSuffix}`,
        enabled: opt.enabled,
        onClick: async () => {
          if (!opt.enabled) {
            const available = Number(opt.availableEnergy ?? NaN);
            const hasNumbers = Number.isFinite(available) && Number.isFinite(opt.requiredEnergy);
            const costMessage =
              hasNumbers && available < opt.requiredEnergy
                ? `Not enough energy (need ${opt.requiredEnergy}, have ${available}).`
                : opt.alreadyUsed
                  ? "Already used this turn."
                  : opt.conditionsMet === false
                    ? "Effect conditions are not met."
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
