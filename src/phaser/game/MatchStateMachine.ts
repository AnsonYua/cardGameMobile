import Phaser from "phaser";
import { GameSessionService, GameStatus, GameMode } from "./GameSessionService";
import type { DeckEntry } from "../api/ApiManager";

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

  async startAsHost(gameConfig: { playerName: string }, opts?: { aiMode?: boolean }) {
    this.transition(GameStatus.CreatingRoom);
    const resp = await this.session.startAsHost(gameConfig, opts);
    this.gameId = resp?.gameId ?? resp?.roomId ?? null;
    this.transition(GameStatus.WaitingOpponent);
    return resp;
    /*
    // Placeholder: simulate opponent join after short delay.
    setTimeout(() => {
      this.transition(GameStatus.Ready);
    }, 500);
    */
  }

  async joinRoom(gameId: string) {
    this.mode = GameMode.Join;
    this.transition(GameStatus.CreatingRoom);
    const resp = await this.session.joinRoom(gameId);
    this.gameId = gameId;
    this.transition(GameStatus.Ready);
    return resp;
  }

  async getGameStatus(gameId: string, playerId: string) {
    return this.session.getGameStatus(gameId, playerId);
  }

  async getGameResource(token: string, gameId: string, playerId: string) {
    return this.session.getGameResource(token, gameId, playerId);
  }

  async getGameResourceBundle(
    token: string,
    opts: { includePreviews?: boolean; includeBothDecks?: boolean; allowEnvScanFallback?: boolean } = {},
  ) {
    return this.session.getGameResourceBundle(token, opts);
  }

  async submitDeck(gameId: string, playerId: string, payload: DeckEntry[] | { deck?: DeckEntry[]; topDeck?: string }) {
    return this.session.submitDeck(gameId, playerId, payload);
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
