import Phaser from "phaser";
import { MatchStateMachine } from "./MatchStateMachine";
import { GameContextStore } from "./GameContextStore";
import { ENGINE_EVENTS } from "./EngineEvents";
import { GamePhase, GameStatusResponse } from "./GameTypes";
import { GameStatus } from "./GameSessionService";
import { CardResourceLoader } from "./CardResourceLoader";

export type GameStatusSnapshot = {
  status: any;
  raw: GameStatusResponse | null;
};

export class GameEngine {
  public events = new Phaser.Events.EventEmitter();
  private lastRaw: GameStatusResponse | null = null;
  private resourceLoader: CardResourceLoader;

  constructor(private scene: Phaser.Scene, private match: MatchStateMachine, private contextStore: GameContextStore) {
    this.resourceLoader = new CardResourceLoader(scene);
  }

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
        // Mark status as loading resources while fetching textures, then emit redraw after load.
        this.contextStore.update({ lastStatus: GameStatus.LoadingResources });
        this.events.emit(ENGINE_EVENTS.STATUS, this.getSnapshot());
        await this.fetchGameResources(gameId, playerId, response);
        this.contextStore.update({ lastStatus: derivedStatus });
        this.events.emit(ENGINE_EVENTS.STATUS, this.getSnapshot());
        this.events.emit(ENGINE_EVENTS.PHASE_REDRAW, this.getSnapshot());
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

  private async fetchGameResources(gameId: string, playerId: string, statusPayload: GameStatusResponse) {
    try {
      const resources = await this.match.getGameResource(gameId, playerId);
      const loadResult = await this.resourceLoader.loadFromGameStatus(resources, this.match.getApiBaseUrl());
      this.events.emit(ENGINE_EVENTS.GAME_RESOURCE, { gameId, playerId, resources, loadResult, statusPayload });
    } catch (err) {
      this.events.emit(ENGINE_EVENTS.STATUS_ERROR, err);
    }
  }
}
