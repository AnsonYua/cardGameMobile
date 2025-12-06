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

  startGame(payload: StartGamePayload): Promise<any> {
    const url = this.buildUrl("/api/game/player/startGame");
    return this.requestWithFallback(url, payload);
  }

  getGameStatus(gameId: string, playerId: string): Promise<any> {
    const url = this.buildUrl(`/api/game/player/${playerId}?gameId=${encodeURIComponent(gameId)}`);
    return this.requestGetWithFallback(url);
  }

  joinRoom(gameId: string, playerId: string, playerName: string): Promise<any> {
    const url = this.buildUrl("/api/game/player/joinRoom");
    return this.requestWithFallback(url, { gameId, playerId, playerName });
  }

  private resolveBaseUrl(baseUrl?: string) {
    if (baseUrl) return baseUrl;
    if (typeof window === "undefined" || !window.location) return "http://localhost:8080";
    const params = new URLSearchParams(window.location.search);
    const apiUrlParam = params.get("apiUrl") || params.get("apiurl");
    const apiHostParam = params.get("apiHost") || params.get("apihost");
    if (apiUrlParam) {
      return apiUrlParam.startsWith("http") ? apiUrlParam : `${window.location.protocol}//${apiUrlParam}`;
    }
    if (apiHostParam) {
      return `${window.location.protocol}//${apiHostParam}:8080`;
    }
    // Default to same origin and rely on Vite proxy for /api.
    return "";
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
    if (!this.baseUrl) return path;
    return `${this.baseUrl}${path}`;
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
