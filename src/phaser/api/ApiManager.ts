import { ApiClient, ApiError, type GameResourceBundleResponse } from "./apiClient";
import type { ScenarioPlayerSelector } from "../game/SeatSelector";

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
export type ResolveSeatSessionResponse = {
  success: boolean;
  gameId?: string;
  requestedPlayerSelector?: ScenarioPlayerSelector;
  resolvedPlayerId?: string;
  sessionToken?: string;
  sessionExpiresAt?: number;
};
export type StartReadyPayload = {
  gameId: string;
  playerId: string;
  isRedraw: boolean;
};
export type DeckEntry = {
  id: string;
  qty: number;
  setId?: string;
  name?: string;
};
export type SubmitDeckPayload = {
  gameId: string;
  playerId: string;
  deck?: DeckEntry[];
  topDeck?: string;
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

export type TopDeckEntry = {
  id: string;
  qty: number;
};

export type TopDeckItem = {
  id: string;
  name: string;
  entries: TopDeckEntry[];
  cardCount: number;
};

export type TopDeckListResponse = {
  success: boolean;
  decks: TopDeckItem[];
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

  submitDeck(payload: SubmitDeckPayload): Promise<any> {
    console.log("[api] submitDeck request", {
      gameId: payload.gameId,
      playerId: payload.playerId,
      deckCount: Array.isArray(payload.deck) ? payload.deck.length : 0,
      topDeck: typeof payload.topDeck === "string" ? payload.topDeck : undefined,
    });
    return this.client.postJson("/api/game/player/submitDeck", payload, { auth: true });
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

  // Top deck pick list parsed from backend requirement/topDeck.md.
  getTopDecks(): Promise<TopDeckListResponse> {
    return this.client.getJson("/api/game/topDecks");
  }

  getGameStatus(gameId: string, playerId: string): Promise<any> {
    const path = `/api/game/player/${playerId}?gameId=${encodeURIComponent(gameId)}`;
    return this.client.getJson(path, { auth: true });
  }

  getTestScenario(scenarioPath: string): Promise<any> {
    const path = `/api/game/test/getTestScenario?scenarioPath=${encodeURIComponent(scenarioPath)}`;
    return this.client.getJson(path);
  }

  injectGameState(gameId: string, gameEnv: any, player?: ScenarioPlayerSelector): Promise<any> {
    return this.client.postJson("/api/game/test/injectGameState", { gameId, gameEnv, player });
  }

  resolveSeatSession(gameId: string, player?: ScenarioPlayerSelector): Promise<ResolveSeatSessionResponse> {
    return this.client.postJson("/api/game/test/resolveSeatSession", { gameId, player });
  }

  getGameResource(token: string, gameId: string, playerId: string, opts?: { includeBothDecks?: boolean }): Promise<any> {
    const includeBothDecks = opts?.includeBothDecks ? "&includeBothDecks=true" : "";
    const path = `/api/game/player/gameResource?gameId=${encodeURIComponent(gameId)}&playerId=${encodeURIComponent(playerId)}${includeBothDecks}`;
    return this.client.getJson(path, { authToken: token });
  }

  async getGameResourceBundle(
    token: string,
    opts: { includePreviews?: boolean; includeBothDecks?: boolean; allowEnvScanFallback?: boolean } = {},
  ): Promise<GameResourceBundleResponse> {
    const includePreviews = opts.includePreviews !== false;
    const includeBothDecks = opts.includeBothDecks === true;
    const allowEnvScanFallback = opts.allowEnvScanFallback === true;
    return this.client.postRaw(
      "/api/game/player/gameResourceBundle",
      { includePreviews, includeBothDecks, allowEnvScanFallback },
      { authToken: token },
    );
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

  joinRoom(gameId: string): Promise<JoinRoomResponse> {
    return this.client.postJson("/api/game/player/joinRoom", { gameId });
  }

  private postPlayerDecision(path: string, payload: Record<string, unknown>) {
    return this.client.postJson(path, payload, { auth: true });
  }
}
