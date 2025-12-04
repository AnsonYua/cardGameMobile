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

  joinRoom(gameId: string, playerId: string): Promise<any> {
    // Placeholder join-room API; replace with real endpoint.
    const url = this.buildUrl("/api/game/player/join");
    return this.requestWithFallback(url, { gameId, playerId });
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

  private async doFetch(url: string, body: Record<string, any>) {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "*/*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(`request failed: ${res.status} ${res.statusText} ${json ? JSON.stringify(json) : ""}`);
    }
    return json;
  }
}
