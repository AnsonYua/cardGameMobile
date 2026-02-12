export type StartGamePayload = {
  playerId: string;
  gameConfig: { playerName: string };
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

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly data: any,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class ApiManager {
  private baseUrl: string;
  private fallbackUrl = "http://localhost:8080";

  constructor(baseUrl?: string) {
    this.baseUrl = this.resolveBaseUrl(baseUrl);
  }

  getBaseUrl() {
    return this.baseUrl;
  }

  startGame(payload: StartGamePayload): Promise<any> {
    const url = this.buildUrl("/api/game/player/startGame");
    return this.requestWithFallback(url, payload);
  }

  startReady(payload: StartReadyPayload): Promise<any> {
    const url = this.buildUrl("/api/game/player/startReady");
    return this.requestWithFallback(url, payload);
  }

  chooseFirstPlayer(payload: ChooseFirstPlayerPayload): Promise<any> {
    const url = this.buildUrl("/api/game/player/chooseFirstPlayer");
    return this.requestWithFallback(url, payload);
  }

  getLobbyList(): Promise<LobbyListResponse> {
    const url = this.buildUrl("/api/game/lobbylist");
    return this.requestGetWithFallback(url);
  }

  getGameStatus(gameId: string, playerId: string): Promise<any> {
    const url = this.buildUrl(`/api/game/player/${playerId}?gameId=${encodeURIComponent(gameId)}`);
    return this.requestGetWithFallback(url);
  }

  getTestScenario(scenarioPath: string): Promise<any> {
    const url = this.buildUrl(`/api/game/test/getTestScenario?scenarioPath=${encodeURIComponent(scenarioPath)}`);
    return this.requestGetWithFallback(url);
  }

  injectGameState(gameId: string, gameEnv: any): Promise<any> {
    const url = this.buildUrl(`/api/game/test/injectGameState`);
    return this.requestWithFallback(url, { gameId, gameEnv });
  }

  getGameResource(gameId: string, playerId: string): Promise<any> {
    const url = this.buildUrl(
      `/api/game/player/gameResource?gameId=${encodeURIComponent(gameId)}&playerId=${encodeURIComponent(playerId)}`,
    );
    return this.requestGetWithFallback(url);
  }

  playCard(payload: { playerId: string; gameId: string; action: { type: string; carduid: string; playAs: string } }) {
    const url = this.buildUrl("/api/game/player/playCard");
    return this.requestWithFallback(url, payload);
  }

  endTurn(payload: { playerId: string; gameId: string }) {
    const url = this.buildUrl("/api/game/player/endTurn");
    return this.requestWithFallback(url, payload);
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
    const url = this.buildUrl("/api/game/player/playerAction");
    return this.requestWithFallback(url, payload);
  }

  joinRoom(gameId: string, playerId: string, playerName?: string): Promise<any> {
    const url = this.buildUrl("/api/game/player/joinRoom");
    const payload: Record<string, string> = { gameId, playerId };
    if (playerName) payload.playerName = playerName;
    return this.requestWithFallback(url, payload);
  }

  private resolveBaseUrl(baseUrl?: string) {
    if (typeof baseUrl === "string" && baseUrl.length > 0) return baseUrl;
    // Allow configuring an explicit API origin at build-time (so the browser calls your backend domain directly).
    // Example: VITE_API_BASE_URL="https://api.example.com"
    const envBaseUrl =
      (import.meta as any)?.env?.VITE_API_BASE_URL ||
      (import.meta as any)?.env?.VITE_BACKEND_URL ||
      "";
    if (typeof envBaseUrl === "string" && envBaseUrl.length > 0) return envBaseUrl;

    // Default to relative requests ("/api/...") so Vite's proxy can route to the backend.
    if (typeof window === "undefined" || !window.location) return "";
    const params = new URLSearchParams(window.location.search);
    const apiUrlParam = params.get("apiUrl") || params.get("apiurl");
    const apiHostParam = params.get("apiHost") || params.get("apihost");
    const { protocol, hostname } = window.location;
    if (apiUrlParam) {
      if (apiUrlParam.startsWith("http")) return apiUrlParam;
      return `${protocol}//${apiUrlParam}`;
    }
    if (apiHostParam) {
      // allow specifying host:port via querystring
      return apiHostParam.includes(":") ? `${protocol}//${apiHostParam}` : `${protocol}//${apiHostParam}:8080`;
    }
    // No explicit API host: use relative URLs (proxy-controlled).
    void hostname; // keep destructure stable if used later
    return "";
  }

  private postPlayerDecision(path: string, payload: Record<string, unknown>) {
    const url = this.buildUrl(path);
    return this.requestWithFallback(url, payload);
  }

  private async requestWithFallback(url: string, body: Record<string, any>) {
    try {
      return await this.doFetch(url, body);
    } catch (err) {
      if (!this.baseUrl) throw err; // relative path already tried through proxy
      // If primary host failed and isn't localhost, try localhost as a fallback (helps when API bound only to loopback).
      if (!this.baseUrl.includes("localhost") && !this.baseUrl.includes("127.0.0.1")) {
        const fallbackUrl = url.replace(this.baseUrl, this.fallbackUrl);
        try {
          return await this.doFetch(fallbackUrl, body);
        } catch {
          // fall through to rethrow original error
        }
      }
      throw err;
    }
  }

  private buildUrl(path: string) {
    const base = this.getBaseUrl();
    if (!base) return path;
    return `${base}${path}`;
  }

  private async requestGetWithFallback(url: string) {
    try {
      return await this.doFetch(url, undefined, "GET");
    } catch (err) {
      if (!this.baseUrl) throw err;
      if (!this.baseUrl.includes("localhost") && !this.baseUrl.includes("127.0.0.1")) {
        const fallbackUrl = url.replace(this.baseUrl, this.fallbackUrl);
        try {
          return await this.doFetch(fallbackUrl, undefined, "GET");
        } catch {
          // fall through to rethrow original error
        }
      }
      throw err;
    }
  }

  private async doFetch(url: string, body?: Record<string, any>, method: "POST" | "GET" = "POST") {
    const res = await fetch(url, {
      method,
      headers: {
        Accept: "*/*",
        "Content-Type": "application/json",
      },
      body: method === "POST" ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const serverMsg =
        (json && typeof json === "object" && (json as any).error && String((json as any).error)) ||
        (json && typeof json === "object" && (json as any).message && String((json as any).message)) ||
        "";
      throw new ApiError(serverMsg || `request failed: ${res.status} ${res.statusText}`, res.status, json);
    }
    return json;
  }
}
