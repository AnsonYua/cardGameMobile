import type { GameContext } from "../game/GameContextStore";
import type { GameEngine } from "../game/GameEngine";
import type { BlockerFlowManager } from "./BlockerFlowManager";
import type { BurstChoiceFlowManager } from "./BurstChoiceFlowManager";
import type { SlotInteractionGate } from "./SlotInteractionGate";
import { createLogger } from "../utils/logger";

export class TurnStateCoordinator {
  private readonly log = createLogger("TurnState");
  constructor(
    private deps: {
      engine: GameEngine;
      gameContext: GameContext;
      slotGate: SlotInteractionGate;
      blockerFlow: BlockerFlowManager;
      burstFlow: BurstChoiceFlowManager;
    },
  ) {}

  syncSnapshotState(raw: any, opts: { isSelfTurn?: boolean } = {}) {
    if (!raw) return;
    const notifications = raw?.gameEnv?.notificationQueue ?? raw?.notificationQueue;
    if (Array.isArray(notifications) && notifications.length) {
      this.log.debug("notificationQueue", {
        count: notifications.length,
        types: notifications.map((entry: any) => entry?.type),
      });
    }
    const isSelfTurn = opts.isSelfTurn ?? this.isPlayersTurnFromRaw(raw);
    if (isSelfTurn) {
      this.deps.slotGate.enable("phase-turn");
    } else {
      this.deps.slotGate.disable("phase-turn");
    }
    this.deps.blockerFlow.handleSnapshot(raw);
    this.deps.burstFlow.syncDecisionState(raw);
  }

  private isPlayersTurnFromRaw(raw: any) {
    const currentPlayer = raw?.gameEnv?.currentPlayer;
    return currentPlayer === this.deps.gameContext.playerId;
  }
}
