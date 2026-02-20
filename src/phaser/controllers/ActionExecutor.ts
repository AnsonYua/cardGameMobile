import type { GameContext } from "../game/GameContextStore";
import type { GameEngine } from "../game/GameEngine";
import type { SlotViewModel } from "../ui/SlotTypes";
import type { ApiManager } from "../api/ApiManager";
import type { AttackTargetCoordinator } from "./AttackTargetCoordinator";
import { getAttackUnitTargets } from "./attackTargetPolicy";
import { isBattleActionStep } from "../game/battleUtils";

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
    const sanitizedPayload = this.sanitizeActionPayload(payload);
    if (!sanitizedPayload) return;
    try {
      await this.deps.api.playerAction(sanitizedPayload);
      const latestContext = this.getLatestContext();
      if (!latestContext) return;
      await this.deps.engine.updateGameStatus(latestContext.gameId, latestContext.playerId);
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
    const raw = this.deps.engine.getSnapshot().raw as any;
    if (!isBattleActionStep(raw)) {
      this.deps.refreshNeutral();
      return;
    }

    const payload = this.buildBattleActionPayload("confirmBattle");
    if (!payload) return;
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

  private getLatestContext(): Pick<Parameters<ApiManager["playerAction"]>[0], "gameId" | "playerId"> | null {
    const { gameId, playerId } = this.deps.gameContext;
    if (!gameId || !playerId) {
      return null;
    }
    return { gameId, playerId };
  }

  private sanitizeActionPayload(
    payload: Parameters<ApiManager["playerAction"]>[0],
  ): Parameters<ApiManager["playerAction"]>[0] | null {
    const context = this.getLatestContext();
    if (!context) {
      return null;
    }
    return {
      ...payload,
      gameId: context.gameId,
      playerId: context.playerId,
    };
  }

  private buildBattleActionPayload(
    actionType: "confirmBattle" | "resolveBattle",
  ): Parameters<ApiManager["playerAction"]>[0] | null {
    const context = this.getLatestContext();
    if (!context) {
      return null;
    }
    return {
      playerId: context.playerId,
      gameId: context.gameId,
      actionType,
    };
  }
}
