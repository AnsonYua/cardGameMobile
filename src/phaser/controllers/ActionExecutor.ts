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
      reportError?: (err: any) => void;
    },
  ) {}

  private async runPlayerAction(
    payload: Parameters<ApiManager["playerAction"]>[0],
    opts: { cancelOnSuccess: boolean; cancelOnError: boolean },
  ) {
    const { gameId, playerId } = this.deps.gameContext;
    if (!gameId || !playerId) return;
    try {
      await this.deps.api.playerAction(payload);
      await this.deps.engine.updateGameStatus(gameId, playerId);
      if (opts.cancelOnSuccess) {
        this.handleCancelSelection();
      }
    } catch (err) {
      this.deps.reportError?.(err);
      if (opts.cancelOnError) {
        this.handleCancelSelection();
      }
    }
  }

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
    await this.runPlayerAction(payload, { cancelOnSuccess: true, cancelOnError: false });
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
    await this.runPlayerAction(payload, { cancelOnSuccess: true, cancelOnError: false });
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
    await this.runPlayerAction(payload as any, { cancelOnSuccess: true, cancelOnError: false });
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
    await this.runPlayerAction(payload, { cancelOnSuccess: true, cancelOnError: true });
  }

  private handleCancelSelection() {
    this.deps.attackCoordinator.reset();
    this.deps.clearSelection();
    this.deps.refreshNeutral();
  }
}
