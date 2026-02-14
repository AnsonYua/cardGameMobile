import { getSessionToken } from "../game/SessionStore";

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

type AuthOptions = {
  auth?: boolean;
  authToken?: string;
};

export type GameResourceBundleResponse = {
  contentType: string;
  data: ArrayBuffer;
};

export class ApiClient {
  private baseUrl: string;
  private fallbackUrl: string;

  constructor(baseUrl?: string, fallbackUrl = "http://localhost:8080") {
    this.baseUrl = this.resolveBaseUrl(baseUrl);
    this.fallbackUrl = fallbackUrl;
  }

  getBaseUrl() {
    return this.baseUrl;
  }

  postJson(path: string, body: Record<string, any>, opts?: AuthOptions) {
    return this.requestJson("POST", path, body, opts);
  }

  getJson(path: string, opts?: AuthOptions) {
    return this.requestJson("GET", path, undefined, opts);
  }

  postRaw(path: string, body: Record<string, any>, opts?: AuthOptions): Promise<GameResourceBundleResponse> {
    return this.requestRaw(path, body, opts);
  }

  private buildUrl(path: string) {
    const base = this.baseUrl;
    if (!base) return path;
    return `${base}${path}`;
  }

  private resolveBaseUrl(baseUrl?: string) {
    if (typeof baseUrl === "string" && baseUrl.length > 0) return baseUrl;
    const envBaseUrl =
      (import.meta as any)?.env?.VITE_API_BASE_URL ||
      (import.meta as any)?.env?.VITE_BACKEND_URL ||
      "";
    if (typeof envBaseUrl === "string" && envBaseUrl.length > 0) return envBaseUrl;

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
      return apiHostParam.includes(":") ? `${protocol}//${apiHostParam}` : `${protocol}//${apiHostParam}:8080`;
    }
    void hostname;
    return "";
  }

  private getAuthToken(opts?: AuthOptions) {
    if (opts?.authToken) return opts.authToken;
    if (!opts?.auth) return null;
    return getSessionToken();
  }

  private async requestJson(
    method: "POST" | "GET",
    path: string,
    body?: Record<string, any>,
    opts?: AuthOptions,
  ) {
    const url = this.buildUrl(path);
    try {
      return await this.doFetchJson(url, method, body, opts);
    } catch (err) {
      if (!this.baseUrl) throw err;
      if (!this.baseUrl.includes("localhost") && !this.baseUrl.includes("127.0.0.1")) {
        const fallbackUrl = url.replace(this.baseUrl, this.fallbackUrl);
        try {
          return await this.doFetchJson(fallbackUrl, method, body, opts);
        } catch {
          // fall through to rethrow original error
        }
      }
      throw err;
    }
  }

  private async requestRaw(path: string, body: Record<string, any>, opts?: AuthOptions): Promise<GameResourceBundleResponse> {
    const url = this.buildUrl(path);
    try {
      return await this.doFetchRaw(url, body, opts);
    } catch (err) {
      if (!this.baseUrl) throw err;
      if (!this.baseUrl.includes("localhost") && !this.baseUrl.includes("127.0.0.1")) {
        const fallbackUrl = url.replace(this.baseUrl, this.fallbackUrl);
        try {
          return await this.doFetchRaw(fallbackUrl, body, opts);
        } catch {
          // fall through to rethrow original error
        }
      }
      throw err;
    }
  }

  private async doFetchRaw(
    url: string,
    body: Record<string, any>,
    opts?: AuthOptions,
  ): Promise<GameResourceBundleResponse> {
    const token = this.getAuthToken(opts);
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "*/*",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const contentType = res.headers.get("content-type") || "";
    const data = await res.arrayBuffer();

    if (!res.ok) {
      let message = `request failed: ${res.status} ${res.statusText}`;
      let parsed: any = null;
      try {
        if (contentType.includes("application/json")) {
          parsed = JSON.parse(new TextDecoder().decode(new Uint8Array(data)));
          message = parsed && (parsed.error || parsed.message) ? String(parsed.error || parsed.message) : message;
        } else {
          const text = new TextDecoder().decode(new Uint8Array(data).slice(0, 4096));
          if (text) message = text;
        }
      } catch {
        // ignore parse errors
      }
      throw new ApiError(message, res.status, parsed);
    }

    return { contentType, data };
  }

  private async doFetchJson(
    url: string,
    method: "POST" | "GET",
    body?: Record<string, any>,
    opts?: AuthOptions,
  ) {
    const token = this.getAuthToken(opts);
    const res = await fetch(url, {
      method,
      headers: {
        Accept: "*/*",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
