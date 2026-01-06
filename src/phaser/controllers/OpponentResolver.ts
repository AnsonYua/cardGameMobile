import type { GameContext } from "../game/GameContextStore";
import type { GameEngine } from "../game/GameEngine";
import type { SlotPresenter } from "../ui/SlotPresenter";
import type { SlotViewModel } from "../ui/SlotTypes";

export class OpponentResolver {
  constructor(
    private deps: {
      engine: GameEngine;
      slotPresenter: SlotPresenter;
      gameContext: GameContext;
    },
  ) {}

  getOpponentRestedUnitSlots(): SlotViewModel[] {
    return this.getOpponentUnitSlots().filter((slot) => !!slot.unit?.isRested);
  }

  getOpponentUnitSlots(): SlotViewModel[] {
    const snapshot = this.deps.engine.getSnapshot();
    const raw: any = snapshot.raw;
    if (!raw) return [];
    const playerId = this.deps.gameContext.playerId;
    const slots = this.deps.slotPresenter.toSlots(raw, playerId);
    return slots.filter((s) => s.owner === "opponent" && !!s.unit);
  }

  getOpponentPlayerId() {
    const raw: any = this.deps.engine.getSnapshot().raw;
    const players = raw?.gameEnv?.players || {};
    const allIds = Object.keys(players);
    const selfId = this.deps.gameContext.playerId;
    return allIds.find((id) => id !== selfId);
  }
}
