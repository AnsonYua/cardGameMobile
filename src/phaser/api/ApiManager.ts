import { ApiClient, ApiError, type GameResourceBundleResponse } from "./apiClient";

export { ApiError };

export type StartGamePayload = {
  gameConfig: { playerName: string };
  aimode?: boolean;
};
export type StartGameResponse = {
  success: boolean;
  gameId?: string;
  roomId?: string;
  playerId?: string;
  sessionToken?: string;
  sessionExpiresAt?: number;
  joinToken?: string;
  gameEnv?: any;
};
export type JoinRoomResponse = {
  success: boolean;
  gameId?: string;
  playerId?: string;
  sessionToken?: string;
  sessionExpiresAt?: number;
  gameEnv?: any;
};
export type StartReadyPayload = {
  gameId: string;
  playerId: string;
  isRedraw: boolean;
};
export type ChooseFirstPlayerPayload = {
  gameId: string;
  playerId: string;
  chosenFirstPlayerId: string;
};
export type LobbyRoomSummary = {
  gameId: string;
  createdAt: string;
};
export type LobbyListResponse = {
  success: boolean;
  rooms: LobbyRoomSummary[];
  timestamp: string;
};

export type CardSetSummary = {
  id: string;
  name: string;
  cardCount?: number;
};

export type CardSetsResponse = {
  success: boolean;
  sets: CardSetSummary[];
  timestamp?: string;
};

export class ApiManager {
  private client: ApiClient;

  constructor(baseUrl?: string) {
    this.client = new ApiClient(baseUrl);
  }

  getBaseUrl() {
    return this.client.getBaseUrl();
  }

  startGame(payload: StartGamePayload): Promise<StartGameResponse> {
    return this.client.postJson("/api/game/player/startGame", payload);
  }

  startReady(payload: StartReadyPayload): Promise<any> {
    return this.client.postJson("/api/game/player/startReady", payload, { auth: true });
  }

  chooseFirstPlayer(payload: ChooseFirstPlayerPayload): Promise<any> {
    return this.client.postJson("/api/game/player/chooseFirstPlayer", payload, { auth: true });
  }

  getLobbyList(): Promise<LobbyListResponse> {
    return this.client.getJson("/api/game/lobbylist");
  }

  // Current backend: GET /api/game/cards returns st01Card.json.
  getCardData(): Promise<any> {
    return this.client.getJson("/api/game/cards");
  }

  // Proposed backend: GET /api/game/cardSets returns available sets (gd01/st01/...).
  getCardSets(): Promise<CardSetsResponse> {
    return this.client.getJson("/api/game/cardSets");
  }

  // Proposed backend: GET /api/game/cards?set=st02 returns that set's JSON.
  getCardsBySet(setId: string): Promise<any> {
    const path = `/api/game/cards?set=${encodeURIComponent(setId)}`;
    return this.client.getJson(path);
  }

  getGameStatus(gameId: string, playerId: string): Promise<any> {
    const path = `/api/game/player/${playerId}?gameId=${encodeURIComponent(gameId)}`;
    return this.client.getJson(path, { auth: true });
  }

  getTestScenario(scenarioPath: string): Promise<any> {
    const path = `/api/game/test/getTestScenario?scenarioPath=${encodeURIComponent(scenarioPath)}`;
    return this.client.getJson(path);
  }

  injectGameState(gameId: string, gameEnv: any): Promise<any> {
    return this.client.postJson("/api/game/test/injectGameState", { gameId, gameEnv });
  }

  getGameResource(token: string, gameId: string, playerId: string): Promise<any> {
    const path = `/api/game/player/gameResource?gameId=${encodeURIComponent(gameId)}&playerId=${encodeURIComponent(playerId)}`;
    return this.client.getJson(path, { authToken: token });
  }

  async getGameResourceBundle(
    token: string,
    opts: { includePreviews?: boolean } = {},
  ): Promise<GameResourceBundleResponse> {
    const includePreviews = opts.includePreviews !== false;
    return this.client.postRaw("/api/game/player/gameResourceBundle", { includePreviews }, { authToken: token });
  }

  playCard(payload: { playerId: string; gameId: string; action: { type: string; carduid: string; playAs: string } }) {
    return this.client.postJson("/api/game/player/playCard", payload, { auth: true });
  }

  endTurn(payload: { playerId: string; gameId: string }) {
    return this.client.postJson("/api/game/player/endTurn", payload, { auth: true });
  }

  confirmTargetChoice(payload: {
    gameId: string;
    playerId: string;
    eventId: string;
    selectedTargets: Array<{ carduid: string; zone: string; playerId: string }>;
  }) {
    return this.postPlayerDecision("/api/game/player/confirmTargetChoice", payload);
  }

  confirmBlockerChoice(payload: {
    gameId: string;
    playerId: string;
    eventId: string;
    notificationId?: string;
    selectedTargets: Array<{ carduid: string; zone: string; playerId: string }>;
  }) {
    return this.postPlayerDecision("/api/game/player/confirmBlockerChoice", payload);
  }

  confirmBurstChoice(payload: {
    gameId: string;
    playerId: string;
    eventId: string;
    confirmed: boolean;
  }) {
    return this.postPlayerDecision("/api/game/player/confirmBurstChoice", payload);
  }

  confirmOptionChoice(payload: {
    gameId: string;
    playerId: string;
    eventId: string;
    selectedOptionIndex: number;
  }) {
    return this.postPlayerDecision("/api/game/player/confirmOptionChoice", payload);
  }

  confirmTokenChoice(payload: {
    gameId: string;
    playerId: string;
    eventId: string;
    selectedChoiceIndex: number;
  }) {
    return this.postPlayerDecision("/api/game/player/confirmTokenChoice", payload);
  }

  cancelChoice(payload: { gameId: string; playerId: string; eventId: string }) {
    return this.postPlayerDecision("/api/game/player/cancelChoice", payload);
  }

  acknowledgeEvents(payload: { gameId: string; playerId: string; eventIds: string[] }) {
    return this.postPlayerDecision("/api/game/player/acknowledgeEvents", payload);
  }

  playerAction(payload: {
    playerId: string;
    gameId: string;
    actionType: string;
    carduid?: string;
    effectId?: string;
    attackerCarduid?: string;
    targetType?: string;
    targetUnitUid?: string;
    targetPlayerId?: string;
    targetPilotUid?: string | null;
  }) {
    return this.client.postJson("/api/game/player/playerAction", payload, { auth: true });
  }

  joinRoom(gameId: string, joinToken: string): Promise<JoinRoomResponse> {
    return this.client.postJson("/api/game/player/joinRoom", { gameId, joinToken });
  }

  private postPlayerDecision(path: string, payload: Record<string, unknown>) {
    return this.client.postJson(path, payload, { auth: true });
  }
}
