import type { ActionContext } from "../game/ActionRegistry";
import type { GameEngine } from "../game/GameEngine";
import type { GameContext } from "../game/GameContextStore";
import type { SlotPresenter } from "../ui/SlotPresenter";
import type { SlotViewModel } from "../ui/SlotTypes";
import type { PilotTargetDialog } from "../ui/PilotTargetDialog";
import type { ErrorDialog } from "../ui/ErrorDialog";
import {
  collectReplaceCandidates,
  isBoardFullReplacePromptError,
  toUserFacingActionError,
  UNIT_BOARD_FULL_REPLACE_MESSAGE,
} from "./unit/UnitReplaceFlowUtils";

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
    return this.tryPlayUnit(ctx);
  }

  private async tryPlayUnit(ctx: ActionContext, replaceSlot?: string): Promise<boolean> {
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
        },
      });
      await ctx.refreshStatus?.();
      ctx.clearSelection?.();
      return true;
    } catch (err) {
      if (!replaceSlot && isBoardFullReplacePromptError(err) && this.canShowReplaceDialog()) {
        this.openReplaceDialog(ctx);
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

  private openReplaceDialog(ctx: ActionContext) {
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
          await this.tryPlayUnit(ctx, slot.slotId);
        } catch (err: any) {
          this.deps?.errorDialog?.show({
            headerText: "Action Failed",
            message: toUserFacingActionError(err),
          });
        }
      },
    });
  }
}
