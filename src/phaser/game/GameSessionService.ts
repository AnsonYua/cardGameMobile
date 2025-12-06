import { ApiManager } from "../api/ApiManager";

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

  async startAsHost(playerId: string, gameConfig: { playerName: string }) {
    this.gameMode = GameMode.Host;
    this.status = GameStatus.CreatingRoom;
    const resp = await this.api.startGame({ playerId, gameConfig });
    this.gameId = resp?.gameId ?? resp?.roomId ?? null;
    this.status = GameStatus.WaitingOpponent;
    return resp;
  }

  async getGameStatus(gameId: string, playerId: string) {
    return this.api.getGameStatus(gameId, playerId);
  }

  async getGameResource(gameId: string, playerId: string) {
    return this.api.getGameResource(gameId, playerId);
  }

  async joinRoom(gameId: string, playerId: string, playerName: string) {
    this.gameMode = GameMode.Join;
    this.status = GameStatus.CreatingRoom;
    const resp = await this.api.joinRoom(gameId, playerId, playerName);
    this.gameId = gameId;
    this.status = GameStatus.Ready;
    return resp;
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
