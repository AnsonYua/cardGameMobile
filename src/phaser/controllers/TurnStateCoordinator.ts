import type { GameContext } from "../game/GameContextStore";
import type { GameEngine } from "../game/GameEngine";
import type { BlockerFlowManager } from "./BlockerFlowManager";
import type { BurstChoiceFlowManager } from "./BurstChoiceFlowManager";
import type { BurstChoiceGroupFlowManager } from "./BurstChoiceGroupFlowManager";
import type { OptionChoiceFlowManager } from "./OptionChoiceFlowManager";
import type { TokenChoiceFlowManager } from "./TokenChoiceFlowManager";
import type { SlotInteractionGate } from "./SlotInteractionGate";
import { getTurnOwnerId } from "../game/turnOwner";
import { createLogger } from "../utils/logger";

export class TurnStateCoordinator {
  private readonly log = createLogger("TurnState");
  constructor(
    private deps: {
      engine: GameEngine;
      gameContext: GameContext;
      slotGate: SlotInteractionGate;
      blockerFlow: BlockerFlowManager;
      burstGroupFlow: BurstChoiceGroupFlowManager;
      burstFlow: BurstChoiceFlowManager;
      optionChoiceFlow: OptionChoiceFlowManager;
      tokenChoiceFlow: TokenChoiceFlowManager;
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
    this.deps.blockerFlow.handleSnapshot(raw);
    this.deps.burstGroupFlow.syncSnapshotState(raw);
    if (!this.deps.burstGroupFlow.isActive()) {
      this.deps.burstFlow.syncDecisionState(raw);
    }
    this.deps.optionChoiceFlow.syncDecisionState(raw);
    this.deps.tokenChoiceFlow.syncDecisionState(raw);

    if (
      this.deps.burstGroupFlow.isActive() ||
      this.deps.burstFlow.isActive() ||
      this.deps.optionChoiceFlow.isActive() ||
      this.deps.tokenChoiceFlow.isActive()
    ) {
      this.deps.slotGate.disable("burst-prompt");
    } else {
      this.deps.slotGate.enable("burst-prompt");
    }

    if (this.deps.optionChoiceFlow.isActive()) {
      this.deps.slotGate.disable("option-choice");
    } else {
      this.deps.slotGate.enable("option-choice");
    }

    if (this.deps.tokenChoiceFlow.isActive()) {
      this.deps.slotGate.disable("token-choice");
    } else {
      this.deps.slotGate.enable("token-choice");
    }

    const isSelfTurn = opts.isSelfTurn ?? this.isPlayersTurnFromRaw(raw);
    if (isSelfTurn) {
      this.deps.slotGate.enable("phase-turn");
    } else {
      this.deps.slotGate.disable("phase-turn");
    }
  }

  private isPlayersTurnFromRaw(raw: any) {
    return getTurnOwnerId(raw) === this.deps.gameContext.playerId;
  }
}
