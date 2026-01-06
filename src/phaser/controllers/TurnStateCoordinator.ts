import type { GameContext } from "../game/GameContextStore";
import type { GameEngine } from "../game/GameEngine";
import type { BlockerFlowManager } from "./BlockerFlowManager";
import type { SlotInteractionGate } from "./SlotInteractionGate";

export class TurnStateCoordinator {
  constructor(
    private deps: {
      engine: GameEngine;
      gameContext: GameContext;
      slotGate: SlotInteractionGate;
      blockerFlow: BlockerFlowManager;
    },
  ) {}

  syncSnapshotState(raw: any, opts: { isSelfTurn?: boolean } = {}) {
    if (!raw) return;
    const isSelfTurn = opts.isSelfTurn ?? this.isPlayersTurnFromRaw(raw);
    if (isSelfTurn) {
      this.deps.slotGate.enable("phase-turn");
    } else {
      this.deps.slotGate.disable("phase-turn");
    }
    this.deps.blockerFlow.handleSnapshot(raw);
  }

  private isPlayersTurnFromRaw(raw: any) {
    const currentPlayer = raw?.gameEnv?.currentPlayer;
    return currentPlayer === this.deps.gameContext.playerId;
  }
}
