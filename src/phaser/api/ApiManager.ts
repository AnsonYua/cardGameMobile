export type StartGamePayload = {
  playerId: string;
  gameConfig: { playerName: string };
};

export class ApiManager {
  private baseUrl: string;
  private fallbackUrl = "http://localhost:8080";

  constructor(baseUrl?: string) {
    this.baseUrl = this.resolveBaseUrl(baseUrl);
  }

  getBaseUrl() {
    if (this.baseUrl) return this.baseUrl;
    if (typeof window !== "undefined" && window.location) {
      const { protocol, hostname } = window.location;
      return `${protocol}//${hostname}:8080`;
    }
    return this.fallbackUrl;
  }

  startGame(payload: StartGamePayload): Promise<any> {
    const url = this.buildUrl("/api/game/player/startGame");
    return this.requestWithFallback(url, payload);
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

  confirmTargetChoice(payload: {
    gameId: string;
    playerId: string;
    eventId: string;
    selectedTargets: Array<{ carduid: string; zone: string; playerId: string }>;
  }) {
    const url = this.buildUrl("/api/game/player/confirmTargetChoice");
    return this.requestWithFallback(url, payload);
  }

  playerAction(payload: {
    playerId: string;
    gameId: string;
    actionType: string;
    attackerCarduid?: string;
    targetType?: string;
    targetUnitUid?: string;
    targetPlayerId?: string;
    targetPilotUid?: string | null;
  }) {
    const url = this.buildUrl("/api/game/player/playerAction");
    return this.requestWithFallback(url, payload);
  }

  joinRoom(gameId: string, playerId: string, playerName: string): Promise<any> {
    const url = this.buildUrl("/api/game/player/joinRoom");
    return this.requestWithFallback(url, { gameId, playerId, playerName });
  }

  private resolveBaseUrl(baseUrl?: string) {
    if (baseUrl) return baseUrl;
    if (typeof window === "undefined" || !window.location) return this.fallbackUrl;
    const params = new URLSearchParams(window.location.search);
    const apiUrlParam = params.get("apiUrl") || params.get("apiurl");
    const apiHostParam = params.get("apiHost") || params.get("apihost");
    const { protocol, hostname } = window.location;
    if (apiUrlParam) {
      if (apiUrlParam.startsWith("http")) return apiUrlParam;
      return `${protocol}//${apiUrlParam}`;
    }
    if (apiHostParam) {
      return `${protocol}//${apiHostParam}:8080`;
    }
    return `${protocol}//${hostname}:8080`;
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
      throw new Error(`request failed: ${res.status} ${res.statusText} ${json ? JSON.stringify(json) : ""}`);
    }
    return json;
  }
}
