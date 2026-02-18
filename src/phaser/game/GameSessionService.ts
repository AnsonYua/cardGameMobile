import { ApiManager } from "../api/ApiManager";
import { updateSession } from "./SessionStore";
import type { DeckEntry } from "../api/ApiManager";
import type { ScenarioPlayerSelector } from "./SeatSelector";

export enum GameStatus {
  Idle = "idle",
  CreatingRoom = "creating_room",
  WaitingOpponent = "waiting_opponent",
  Ready = "ready",
  InMatch = "in_match",
  LoadingResources = "loading_resources",
  Error = "error",
}

export enum GameMode {
  Host = "host",
  Join = "join",
}

export class GameSessionService {
  private status: GameStatus = GameStatus.Idle;
  private gameId: string | null = null;
  private gameMode: GameMode = GameMode.Host;

  constructor(private api: ApiManager) {}

  getState() {
    return {
      status: this.status,
      gameId: this.gameId,
      gameMode: this.gameMode,
    };
  }

  async startAsHost(gameConfig: { playerName: string }, opts?: { aiMode?: boolean }) {
    this.gameMode = GameMode.Host;
    this.status = GameStatus.CreatingRoom;
    const payload: { gameConfig: { playerName: string }; aimode?: boolean } = { gameConfig };
    if (opts?.aiMode) payload.aimode = true;
    const resp = await this.api.startGame(payload);
    this.gameId = resp?.gameId ?? resp?.roomId ?? null;
    updateSession({
      gameId: resp?.gameId ?? resp?.roomId ?? undefined,
      playerId: resp?.playerId,
      joinToken: resp?.joinToken,
      sessionToken: resp?.sessionToken,
      sessionExpiresAt: resp?.sessionExpiresAt,
    });
    this.status = GameStatus.WaitingOpponent;
    return resp;
  }

  async getGameStatus(gameId: string, playerId: string) {
    return this.api.getGameStatus(gameId, playerId);
  }

  async getGameResource(token: string, gameId: string, playerId: string, opts?: { includeBothDecks?: boolean }) {
    return this.api.getGameResource(token, gameId, playerId, opts);
  }

  async getGameResourceBundle(
    token: string,
    opts: { includePreviews?: boolean; includeBothDecks?: boolean; allowEnvScanFallback?: boolean } = {},
  ) {
    return this.api.getGameResourceBundle(token, opts);
  }

  async submitDeck(
    gameId: string,
    playerId: string,
    payload: DeckEntry[] | { deck?: DeckEntry[]; topDeck?: string },
  ) {
    const body =
      Array.isArray(payload)
        ? { gameId, playerId, deck: payload }
        : {
            gameId,
            playerId,
            deck: Array.isArray(payload.deck) ? payload.deck : undefined,
            topDeck: typeof payload.topDeck === "string" ? payload.topDeck : undefined,
          };
    return this.api.submitDeck(body);
  }

  async joinRoom(gameId: string) {
    this.gameMode = GameMode.Join;
    this.status = GameStatus.CreatingRoom;
    const resp = await this.api.joinRoom(gameId);
    this.gameId = gameId;
    updateSession({
      gameId,
      playerId: resp?.playerId,
      sessionToken: resp?.sessionToken,
      sessionExpiresAt: resp?.sessionExpiresAt,
    });
    this.status = GameStatus.Ready;
    return resp;
  }

  async resolveSeatSession(gameId: string, player?: ScenarioPlayerSelector) {
    return this.api.resolveSeatSession(gameId, player);
  }

  getApiBaseUrl() {
    return this.api.getBaseUrl();
  }

  markReady() {
    this.status = GameStatus.Ready;
  }

  markInMatch() {
    this.status = GameStatus.InMatch;
  }

  markError() {
    this.status = GameStatus.Error;
  }
}
