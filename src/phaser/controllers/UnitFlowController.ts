import type { ActionContext } from "../game/ActionRegistry";

export class UnitFlowController {
  async handlePlayUnit(ctx: ActionContext): Promise<boolean> {
    const sel = ctx.selection;
    if (!sel || sel.kind !== "hand" || (sel.cardType || "").toLowerCase() !== "unit") return false;
    if (!ctx.gameId || !ctx.playerId || !ctx.runPlayCard) return false;
    await ctx.runPlayCard({
      playerId: ctx.playerId,
      gameId: ctx.gameId,
      action: { type: "PlayCard", carduid: sel.uid, playAs: "unit" },
    });
    await ctx.refreshStatus?.();
    ctx.clearSelection?.();
    return true;
  }
}
