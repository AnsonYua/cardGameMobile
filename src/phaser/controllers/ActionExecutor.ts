import type { GameContext } from "../game/GameContextStore";
import type { GameEngine } from "../game/GameEngine";
import type { SlotViewModel } from "../ui/SlotTypes";
import type { ApiManager } from "../api/ApiManager";
import type { AttackTargetCoordinator } from "./AttackTargetCoordinator";
import { getAttackUnitTargets } from "./attackTargetPolicy";

export class ActionExecutor {
  constructor(
    private deps: {
      api: ApiManager;
      engine: GameEngine;
      gameContext: GameContext;
      attackCoordinator: AttackTargetCoordinator;
      getSelectedSlot: () => SlotViewModel | undefined;
      getOpponentRestedUnitSlots: () => SlotViewModel[];
      getOpponentUnitSlots: () => SlotViewModel[];
      getOpponentPlayerId: () => string | undefined;
      clearSelection: () => void;
      refreshNeutral: () => void;
    },
  ) {}

  async handleAttackUnit() {
    const attacker = this.deps.getSelectedSlot();
    if (!attacker) {
      return;
    }
    if (attacker.unit?.isRested) {
      return;
    }
    const opponentSlots = this.deps.getOpponentUnitSlots();
    const targets = getAttackUnitTargets(attacker, opponentSlots);
    if (!targets.length) {
      return;
    }
    this.deps.attackCoordinator.enter(
      targets,
      async (slot) => {
        await this.performAttackUnit(slot);
      },
      () => this.handleCancelSelection(),
    );
  }

  async handleAttackShieldArea() {
    const attacker = this.deps.getSelectedSlot();
    if (!attacker?.unit?.cardUid) {
      return;
    }
    if (attacker.unit?.isRested) {
      return;
    }
    const attackerCarduid = attacker.unit.cardUid;
    const targetPlayerId = this.deps.getOpponentPlayerId();
    const gameId = this.deps.gameContext.gameId;
    const playerId = this.deps.gameContext.playerId;
    if (!gameId || !playerId || !targetPlayerId) {
      return;
    }
    const payload = {
      playerId,
      gameId,
      actionType: "attackShieldArea",
      attackerCarduid,
      targetType: "shield",
      targetPlayerId,
      targetPilotUid: null as string | null,
    };
    try {
      await this.deps.api.playerAction(payload);
      await this.deps.engine.updateGameStatus(gameId, playerId);
      this.handleCancelSelection();
    } catch (err) {
      void err;
    }
  }

  async handleSkipAction() {
    const gameId = this.deps.gameContext.gameId;
    const playerId = this.deps.gameContext.playerId;
    if (!gameId || !playerId) return;
    const payload = {
      playerId,
      gameId,
      actionType: "confirmBattle",
    };
    try {
      await this.deps.api.playerAction(payload);
      await this.deps.engine.updateGameStatus(gameId, playerId);
      this.handleCancelSelection();
    } catch (err) {
      void err;
    }
  }

  async handleActivateCardAbility(carduid: string, effectId: string) {
    const gameId = this.deps.gameContext.gameId;
    const playerId = this.deps.gameContext.playerId;
    if (!gameId || !playerId || !carduid || !effectId) return;
    const payload = {
      playerId,
      gameId,
      actionType: "activateCardAbility",
      carduid,
      effectId,
    };
    try {
      await this.deps.api.playerAction(payload as any);
      await this.deps.engine.updateGameStatus(gameId, playerId);
      this.handleCancelSelection();
    } catch (err) {
      void err;
    }
  }

  cancelSelection() {
    this.handleCancelSelection();
  }

  private async performAttackUnit(target: SlotViewModel) {
    const attacker = this.deps.getSelectedSlot();
    if (!attacker?.unit?.cardUid) {
      return;
    }
    const attackerCarduid = attacker.unit.cardUid;
    const targetUnitUid = target.unit?.cardUid;
    const targetPlayerId = this.deps.getOpponentPlayerId();
    const gameId = this.deps.gameContext.gameId;
    const playerId = this.deps.gameContext.playerId;
    if (!gameId || !playerId || !targetUnitUid || !targetPlayerId) {
      return;
    }
    const payload = {
      playerId,
      gameId,
      actionType: "attackUnit",
      attackerCarduid,
      targetType: "unit",
      targetUnitUid,
      targetPlayerId,
      targetPilotUid: null,
    };
    try {
      await this.deps.api.playerAction(payload);
      await this.deps.engine.updateGameStatus(gameId, playerId);
      this.handleCancelSelection();
    } catch (err) {
      void err;
      this.handleCancelSelection();
    }
  }

  private handleCancelSelection() {
    this.deps.attackCoordinator.reset();
    this.deps.clearSelection();
    this.deps.refreshNeutral();
  }
}
