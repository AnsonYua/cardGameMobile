import Phaser from "phaser";
import { MatchStateMachine } from "./MatchStateMachine";
import { GameMode, GameStatus } from "./GameSessionService";

export type GameContext = {
  playerId: string;
  playerName: string;
  gameId: string | null;
  status: GameStatus;
  mode: GameMode;
  lastStatus: any;
};

export type GameStatusSnapshot = {
  status: any;
  raw: any;
};

export class GameEngine {
  public events = new Phaser.Events.EventEmitter();
  private context: GameContext = {
    playerId: "playerId_1",
    playerName: "Demo Player",
    gameId: null,
    status: GameStatus.Idle,
    mode: GameMode.Host,
    lastStatus: null,
  };
  private lastRaw: any = null;

  constructor(private match: MatchStateMachine) {}

  async updateGameStatus(gameId?: string, playerId?: string) {
    if (!gameId || !playerId) return this.getSnapshot();
    const previousPhase = this.lastRaw?.gameEnv?.phase ?? this.lastRaw?.phase ?? null;
    try {
      const response = await this.match.getGameStatus(gameId, playerId);
      // Prefer explicit status fields, otherwise fall back to the entire payload.
      const derivedStatus = response?.status ?? response?.gameStatus ?? response;
      const nextPhase = response?.gameEnv?.phase ?? response?.phase ?? null;
      this.lastRaw = response;
      this.context.lastStatus = derivedStatus;
      this.events.emit("status", this.getSnapshot());

      if (previousPhase !== "REDRAW_PHASE" && nextPhase === "REDRAW_PHASE") {
        this.events.emit("phase:redraw", this.getSnapshot());
      }

      /* if old game status !=REDRAW_PHASE and new gameEnv.phase = REDRAW_PHASE
         call startGame in BoardScene.ts
         save the new gamestatus in gamecontext
      */

      return this.snapshot;
    } catch (err) {
      this.events.emit("status-error", err);
      throw err;
    }
  }

  getContext(): GameContext {
    return this.context;
  }

  getSnapshot(): GameStatusSnapshot {
    return { status: this.context.lastStatus, raw: this.lastRaw };
  }
}
