import Phaser from "phaser";
import { GameSessionService, GameStatus, GameMode } from "./GameSessionService";

export type MatchState = { status: GameStatus; gameId: string | null; mode: GameMode };

export class MatchStateMachine {
  public events = new Phaser.Events.EventEmitter();
  private status: GameStatus = GameStatus.Idle;
  private gameId: string | null = null;
  private mode: GameMode = GameMode.Host;

  constructor(private session: GameSessionService) {}

  getState(): MatchState {
    return { status: this.status, gameId: this.gameId, mode: this.mode };
  }

  async startAsHost(playerId: string, gameConfig: { playerName: string }) {
    this.transition(GameStatus.CreatingRoom);
    const resp = await this.session.startAsHost(playerId, gameConfig);
    this.gameId = resp?.gameId ?? resp?.roomId ?? null;
    this.transition(GameStatus.WaitingOpponent);
    /*
    // Placeholder: simulate opponent join after short delay.
    setTimeout(() => {
      this.transition(GameStatus.Ready);
    }, 500);
    */
  }

  async joinRoom(gameId: string, playerId: string, playerName: string) {
    this.mode = GameMode.Join;
    this.transition(GameStatus.CreatingRoom);
    // Use fixed join credentials to align with backend sample call.
    const joinPlayerId = "playerId_2";
    const joinPlayerName = "Demo Opponent";
    await this.session.joinRoom(gameId, joinPlayerId, joinPlayerName);
    this.gameId = gameId;
    this.transition(GameStatus.Ready);
  }

  async getGameStatus(gameId: string, playerId: string) {
    return this.session.getGameStatus(gameId, playerId);
  }

  async getGameResource(gameId: string, playerId: string) {
    return this.session.getGameResource(gameId, playerId);
  }

  getApiBaseUrl() {
    return this.session.getApiBaseUrl();
  }

  startMatch() {
    if (this.status !== GameStatus.Ready) return;
    this.transition(GameStatus.InMatch);
  }

  markError() {
    this.transition(GameStatus.Error);
  }

  private transition(next: GameStatus) {
    this.status = next;
    this.session.getState(); // keep session in sync for future expansion
    this.events.emit("status", this.getState());
  }
}
