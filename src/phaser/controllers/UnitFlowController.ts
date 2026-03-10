import type { ActionContext } from "../game/ActionRegistry";
import type { GameEngine } from "../game/GameEngine";
import type { GameContext } from "../game/GameContextStore";
import type { SlotPresenter } from "../ui/SlotPresenter";
import type { SlotViewModel } from "../ui/SlotTypes";
import type { PilotTargetDialog } from "../ui/PilotTargetDialog";
import type { ErrorDialog } from "../ui/ErrorDialog";
import { getEnergyState } from "../game/actionEligibility";
import { evaluateComparisonFilter } from "../utils/comparisonFilter";
import {
  collectReplaceCandidates,
  isBoardFullReplacePromptError,
  toUserFacingActionError,
  UNIT_BOARD_FULL_REPLACE_MESSAGE,
} from "./unit/UnitReplaceFlowUtils";
import { analyzeUnitPlaySubmission } from "./unit/unitPlaySubmission";

type CostReplacementChoice = {
  useCostReplacement: true;
  costReplacementTargetCarduid: string;
};

type CostReplacementResolution = {
  cancelled: boolean;
  choice?: CostReplacementChoice;
};

export class UnitFlowController {
  constructor(
    private deps?: {
      engine: GameEngine;
      gameContext: GameContext;
      slotPresenter: SlotPresenter;
      pilotTargetDialog: PilotTargetDialog;
      errorDialog?: ErrorDialog | null;
    },
  ) {}

  async handlePlayUnit(ctx: ActionContext): Promise<boolean> {
    const sel = ctx.selection;
    if (!sel || sel.kind !== "hand" || (sel.cardType || "").toLowerCase() !== "unit") return false;
    if (!ctx.gameId || !ctx.playerId || !ctx.runPlayCard) return false;

    const replacement = await this.resolveCostReplacementChoice(ctx);
    if (replacement.cancelled) {
      return false;
    }

    const submission = analyzeUnitPlaySubmission({
      raw: this.deps?.engine?.getSnapshot().raw,
      playerId: ctx.playerId,
      selectionUid: sel.uid,
    });
    if (submission.requiresBoardReplacementSelection && this.canShowReplaceDialog()) {
      this.openReplaceDialog(ctx, replacement.choice);
      return false;
    }

    return this.tryPlayUnit(ctx, undefined, replacement.choice);
  }

  private async tryPlayUnit(
    ctx: ActionContext,
    replaceSlot?: string,
    costReplacement?: CostReplacementChoice,
  ): Promise<boolean> {
    const sel = ctx.selection;
    if (!sel || sel.kind !== "hand" || (sel.cardType || "").toLowerCase() !== "unit") return false;
    if (!ctx.gameId || !ctx.playerId || !ctx.runPlayCard) return false;

    try {
      await ctx.runPlayCard({
        playerId: ctx.playerId,
        gameId: ctx.gameId,
        action: {
          type: "PlayCard",
          carduid: sel.uid,
          playAs: "unit",
          ...(replaceSlot ? { replaceSlot } : {}),
          ...(costReplacement || {}),
        },
      });
      await ctx.refreshStatus?.();
      ctx.clearSelection?.();
      return true;
    } catch (err) {
      if (!replaceSlot && !costReplacement && isBoardFullReplacePromptError(err) && this.canShowReplaceDialog()) {
        this.openReplaceDialog(ctx, costReplacement);
        return false;
      }
      throw err;
    }
  }

  private canShowReplaceDialog() {
    return !!this.deps?.engine && !!this.deps?.gameContext?.playerId && !!this.deps?.slotPresenter && !!this.deps?.pilotTargetDialog;
  }

  private getReplaceCandidates() {
    const raw = this.deps?.engine.getSnapshot().raw;
    const playerId = this.deps?.gameContext?.playerId;
    if (!this.deps?.slotPresenter) return [];
    return collectReplaceCandidates(raw, playerId, this.deps.slotPresenter);
  }

  private openReplaceDialog(ctx: ActionContext, costReplacement?: CostReplacementChoice) {
    const targets = this.getReplaceCandidates();
    if (!targets.length) {
      this.deps?.errorDialog?.show({
        headerText: "Action Failed",
        message: UNIT_BOARD_FULL_REPLACE_MESSAGE,
      });
      return;
    }

    this.deps?.pilotTargetDialog.show({
      header: "Board is full - Choose a slot to trash",
      targets,
      allowPiloted: true,
      onSelect: async (slot: SlotViewModel) => {
        try {
          await this.tryPlayUnit(ctx, slot.slotId, costReplacement);
        } catch (err: any) {
          this.deps?.errorDialog?.show({
            headerText: "Action Failed",
            message: toUserFacingActionError(err),
          });
        }
      },
    });
  }

  private async resolveCostReplacementChoice(ctx: ActionContext): Promise<CostReplacementResolution> {
    const sel = ctx.selection;
    if (!sel || sel.kind !== "hand" || !this.deps?.engine || !ctx.playerId) {
      return { cancelled: false };
    }

    const raw = this.deps.engine.getSnapshot().raw;
    const handCard = this.findHandCard(raw, ctx.playerId, sel.uid);
    const cardData = handCard?.cardData;
    if (!cardData) {
      return { cancelled: false };
    }

    const replacement = this.getDestroyLinkedReplacementOption(raw, ctx.playerId, cardData);
    if (!replacement) {
      return { cancelled: false };
    }

    const player = raw?.gameEnv?.players?.[ctx.playerId];
    const { totalEnergy, availableEnergy } = getEnergyState(player);

    const requiredLevel = Number(cardData.effectiveLevel ?? cardData.level ?? 0);
    const requiredCost = Number(cardData.effectiveCost ?? cardData.cost ?? 0);
    const baseLevel = Number.isFinite(requiredLevel) ? Math.max(0, requiredLevel) : 0;
    const baseCost = Number.isFinite(requiredCost) ? Math.max(0, requiredCost) : 0;
    const baseAffordable = totalEnergy >= baseLevel && availableEnergy >= baseCost;

    const replacementAffordable =
      totalEnergy >= replacement.replacementLevel && availableEnergy >= replacement.replacementCost;

    if (!replacementAffordable) {
      return { cancelled: false };
    }

    let shouldUseReplacement = !baseAffordable;
    if (baseAffordable) {
      if (typeof window === "undefined") {
        shouldUseReplacement = false;
      } else {
        shouldUseReplacement = window.confirm(
          "Use this card's replacement effect? This will destroy one of your linked Unicorn Mode Lv.5 units and play this card as Lv.0 / Cost.0.",
        );
      }
    }

    if (!shouldUseReplacement) {
      return { cancelled: false };
    }

    let selectedTarget = replacement.eligibleTargets[0];
    if (replacement.eligibleTargets.length > 1) {
      const picked = await this.selectReplacementTarget(replacement.eligibleTargets);
      if (!picked) {
        if (!baseAffordable) {
          this.deps?.errorDialog?.show({
            headerText: "Action Failed",
            message: "Cost replacement requires selecting a linked Unicorn Mode Lv.5 unit.",
          });
          return { cancelled: true };
        }
        return { cancelled: true };
      }
      selectedTarget = picked;
    }

    const targetCarduid = selectedTarget?.unit?.cardUid;
    if (!targetCarduid) {
      return { cancelled: true };
    }

    return {
      cancelled: false,
      choice: {
        useCostReplacement: true,
        costReplacementTargetCarduid: targetCarduid,
      },
    };
  }

  private findHandCard(raw: any, playerId: string, carduid: string): any {
    const hand = raw?.gameEnv?.players?.[playerId]?.deck?.hand;
    if (!Array.isArray(hand)) {
      return undefined;
    }

    return hand.find((entry: any) => {
      const uid = entry?.carduid ?? entry?.uid ?? entry?.id ?? entry?.cardId;
      return uid === carduid;
    });
  }

  private getDestroyLinkedReplacementOption(raw: any, playerId: string, cardData: any): {
    replacementCost: number;
    replacementLevel: number;
    eligibleTargets: SlotViewModel[];
  } | null {
    const rules = Array.isArray(cardData?.effects?.rules) ? cardData.effects.rules : [];
    const replacementRule = rules.find((rule: any) => {
      if (!rule || typeof rule !== "object") return false;
      if ((rule?.type || "").toString().toLowerCase() !== "play") return false;
      if ((rule?.trigger || "").toString().toLowerCase() !== "cost") return false;
      if ((rule?.action || "").toString().toLowerCase() !== "replace_cost") return false;

      const from = rule?.parameters?.replace?.from;
      return from?.type === "destroy" && from?.target === "friendly_linked_unit";
    });

    if (!replacementRule || !this.deps?.slotPresenter) {
      return null;
    }

    const filters = replacementRule?.parameters?.replace?.from?.filters ?? {};
    const requiredCardType = this.normalizeText(filters?.cardType);
    const requiredNameIncludes = this.normalizeText(filters?.nameIncludes);
    const requiredLevel = filters?.level;

    const allSlots = this.deps.slotPresenter.toSlots(raw, playerId);
    const eligibleTargets = allSlots.filter((slot) => {
      if (slot.owner !== "player") return false;
      if (!slot.unit?.cardUid || !slot.unit?.cardData) return false;
      if (!this.isLinkedUnitSlot(slot)) return false;

      const unitCardType = this.normalizeText(slot.unit.cardData?.cardType);
      if (requiredCardType && unitCardType !== requiredCardType) {
        return false;
      }

      const unitName = this.normalizeText(slot.unit.cardData?.name ?? slot.unit.id ?? "");
      if (requiredNameIncludes && !unitName.includes(requiredNameIncludes)) {
        return false;
      }

      const level = Number(slot.unit.cardData?.level ?? 0);
      return this.matchesLevel(level, requiredLevel);
    });

    if (!eligibleTargets.length) {
      return null;
    }

    const to = replacementRule?.parameters?.replace?.to ?? {};
    const replacementCost = Number(to?.cost ?? 0);
    const replacementLevel = Number(to?.level ?? 0);

    return {
      replacementCost: Number.isFinite(replacementCost) ? Math.max(0, replacementCost) : 0,
      replacementLevel: Number.isFinite(replacementLevel) ? Math.max(0, replacementLevel) : 0,
      eligibleTargets,
    };
  }

  private isLinkedUnitSlot(slot: SlotViewModel): boolean {
    if (!slot.unit) {
      return false;
    }

    if (!slot.pilot) {
      // For GD01-002 replacement eligibility, link-capable units count even if currently unpaired.
      const linkList = Array.isArray(slot.unit?.cardData?.link) ? slot.unit?.cardData?.link : [];
      return linkList.length > 0;
    }

    // Frontend snapshots may omit link metadata; allow unit+pilot pair for replacement candidate UI.
    const unitLinks = Array.isArray(slot.unit?.cardData?.link) ? slot.unit?.cardData?.link : [];
    const pilotName = this.normalizeText(slot.pilot?.cardData?.name);
    if (!unitLinks.length || !pilotName) {
      return true;
    }

    return unitLinks.some((name: string) => this.normalizeText(name) === pilotName);
  }

  private normalizeText(value: unknown): string {
    return typeof value === "string" ? value.trim().toLowerCase() : "";
  }

  private matchesLevel(level: number, filter: unknown): boolean {
    const safeLevel = Number.isFinite(level) ? level : 0;

    if (typeof filter === "number") {
      return safeLevel === filter;
    }

    if (typeof filter !== "string" || !filter.trim()) {
      return true;
    }

    const normalized = filter.trim();
    if (/^\d+$/.test(normalized)) {
      return safeLevel === Number(normalized);
    }
    if (/^=\d+$/.test(normalized)) {
      return safeLevel === Number(normalized.slice(1));
    }

    return evaluateComparisonFilter(safeLevel, normalized);
  }

  private selectReplacementTarget(targets: SlotViewModel[]): Promise<SlotViewModel | undefined> {
    return new Promise((resolve) => {
      const dialog = this.deps?.pilotTargetDialog;
      if (!dialog) {
        resolve(undefined);
        return;
      }

      let settled = false;
      const finish = (slot?: SlotViewModel) => {
        if (settled) return;
        settled = true;
        resolve(slot);
      };

      dialog.show({
        header: "Choose linked Unicorn Mode Lv.5 unit to destroy",
        targets,
        allowPiloted: false,
        onSelect: async (slot: SlotViewModel) => {
          finish(slot);
        },
        onClose: () => {
          finish(undefined);
        },
      });
    });
  }
}
