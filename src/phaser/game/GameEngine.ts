import Phaser from "phaser";
import { MatchStateMachine } from "./MatchStateMachine";
import { GameContextStore } from "./GameContextStore";
import { ENGINE_EVENTS } from "./EngineEvents";
import { GamePhase, GameStatusResponse } from "./GameTypes";

export type GameStatusSnapshot = {
  status: any;
  raw: GameStatusResponse | null;
};

export class GameEngine {
  public events = new Phaser.Events.EventEmitter();
  private lastRaw: GameStatusResponse | null = null;

  constructor(private match: MatchStateMachine, private contextStore: GameContextStore) {}

  async updateGameStatus(gameId?: string, playerId?: string) {
    if (!gameId || !playerId) return this.getSnapshot();
    const previousPhase = this.lastRaw?.gameEnv?.phase ?? this.lastRaw?.phase ?? null;
    try {
      const response: GameStatusResponse = await this.match.getGameStatus(gameId, playerId);
      // Prefer explicit status fields, otherwise fall back to the entire payload.
      const derivedStatus = response?.status ?? response?.gameStatus ?? response;
      const nextPhase = response?.gameEnv?.phase ?? response?.phase ?? null;
      this.lastRaw = response;
      this.contextStore.update({ lastStatus: derivedStatus });
      this.events.emit(ENGINE_EVENTS.STATUS, this.getSnapshot());

      if (previousPhase !== GamePhase.Redraw && nextPhase === GamePhase.Redraw) {
        // Emit redraw so listeners (e.g., BoardScene) can start the match UI and optionally trigger a
        // follow-up resource fetch through ApiManager if needed (e.g., /api/game/player/gameResource).
        this.events.emit(ENGINE_EVENTS.PHASE_REDRAW, this.getSnapshot());
        await this.fetchGameResources(gameId, playerId);
      }

      return this.getSnapshot();
    } catch (err) {
      this.events.emit(ENGINE_EVENTS.STATUS_ERROR, err);
      throw err;
    }
  }

  getSnapshot(): GameStatusSnapshot {
    const ctx = this.contextStore.get();
    return { status: ctx.lastStatus, raw: this.lastRaw };
  }

  getContext() {
    return this.contextStore.get();
  }

  private async fetchGameResources(gameId: string, playerId: string) {
    try {
      const resources = await this.match.getGameResource(gameId, playerId);
      this.events.emit(ENGINE_EVENTS.GAME_RESOURCE, { gameId, playerId, resources });
    } catch (err) {
      this.events.emit(ENGINE_EVENTS.STATUS_ERROR, err);
    }
  }
}
