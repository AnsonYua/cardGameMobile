import { ENGINE_EVENTS } from "../game/EngineEvents";
import type { ActionContext } from "../game/ActionRegistry";
import type { GameEngine } from "../game/GameEngine";

export class CommandFlowController {
  constructor(private engine: GameEngine) {}

  // Handles both regular commands and pilot-designation commands.
  async handlePlayCommand(ctx: ActionContext): Promise<boolean> {
    const sel = ctx.selection;
    if (!sel || sel.kind !== "hand" || (sel.cardType || "").toLowerCase() !== "command") return false;

    if (sel.fromPilotDesignation) {
      // Defer to pilot designation dialog flow.
      this.engine.events.emit(ENGINE_EVENTS.PILOT_DESIGNATION_DIALOG, { selection: sel });
      return false;
    }

    if (!ctx.gameId || !ctx.playerId || !ctx.runPlayCard) return false;
    await ctx.runPlayCard({
      playerId: ctx.playerId,
      gameId: ctx.gameId,
      action: { type: "PlayCard", carduid: sel.uid, playAs: "command" },
    });
    await ctx.refreshStatus?.();
    ctx.clearSelection?.();
    return true;
  }
}
