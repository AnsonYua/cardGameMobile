import Phaser from "phaser";
import type { GameStatusResponse } from "./GameTypes";
import { isDebugFlagEnabled } from "../utils/debugFlags";

export type GameResourceBundle = {
  contentType: string;
  data: ArrayBuffer;
};

type MultipartPart = {
  headers: Record<string, string>;
  body: Uint8Array;
};

const resourceDebugSeen = new Set<string>();

const toArrayBuffer = (body: Uint8Array): ArrayBuffer => {
  const copy = new Uint8Array(body.byteLength);
  copy.set(body);
  return copy.buffer;
};

type LoadStats = {
  totalRequests: number;
  successfulLoads: number;
  failedLoads: number;
  cachedHits: number;
  loadStartTime: number | null;
  loadEndTime: number | null;
  averageLoadTime: number | null;
  loadedResourcesCount: number;
  failedResourcesCount: number;
  activeLoadingCount: number;
  totalLoadTime: number | null;
  successRate: string;
};

const initialStats = (): LoadStats => ({
  totalRequests: 0,
  successfulLoads: 0,
  failedLoads: 0,
  cachedHits: 0,
  loadStartTime: null,
  loadEndTime: null,
  averageLoadTime: null,
  loadedResourcesCount: 0,
  failedResourcesCount: 0,
  activeLoadingCount: 0,
  totalLoadTime: null,
  successRate: "0%",
});

export class CardResourceLoader {
  private stats: LoadStats = initialStats();
  private loadedResources = new Map<string, { path: string; isPreview: boolean; loadTime: number; attempts: number }>();
  private loadingKeys = new Set<string>();

  constructor(private scene: Phaser.Scene) {}

  async loadFromGameStatus(gameStatus: GameStatusResponse, baseOverride?: string) {
    const decks = gameStatus?.decks as any;
    if (!decks) return { success: true, stats: this.stats, loadedCount: 0, failedCount: 0 };

    const cardPaths = this.collectCardPaths(decks);
    if (!cardPaths.length) return { success: true, stats: this.stats, loadedCount: 0, failedCount: 0 };

    const baseUrl = baseOverride || this.resolveBaseUrl(gameStatus) || (typeof window !== "undefined" ? window.location.origin : "");
    if (!baseUrl) {
      return { success: false, stats: this.stats, loadedCount: 0, failedCount: cardPaths.length };
    }

    this.stats = initialStats();
    this.stats.loadStartTime = Date.now();

    const queueResult = this.queueLoads(cardPaths, baseUrl);
    if (queueResult.totalQueued === 0) {
      this.finishStats();
      return { success: true, stats: this.stats, loadedCount: this.stats.loadedResourcesCount, failedCount: this.stats.failedResourcesCount };
    }

    await this.startLoader();
    this.finishStats();
    const success = this.stats.failedResourcesCount === 0;
    return { success, stats: this.stats, loadedCount: this.stats.loadedResourcesCount, failedCount: this.stats.failedResourcesCount };
  }

  private collectCardPaths(decks: any): string[] {
    const paths = new Set<string>();
    Object.values(decks || {}).forEach((deck: any) => {
      (deck?.cards || []).forEach((card: string) => {
        const normalized = this.normalizePath(card);
        if (normalized) paths.add(normalized);
      });
    });
    return Array.from(paths);
  }

  private normalizePath(path: string | undefined | null) {
    if (!path) return null;
    // Backend may send paths with or without extension; keep existing extensions intact.
    return /\.(png|jpe?g)$/i.test(path) ? path : `${path}.jpeg`;
  }

  private resolveBaseUrl(payload: any): string | null {
    const candidates = [
      payload?.assetsBaseUrl,
      payload?.assetBaseUrl,
      payload?.baseImageUrl,
      payload?.imageBaseUrl,
      payload?.resourceBaseUrl,
      payload?.cdnBaseUrl,
      payload?.baseUrl,
    ].filter(Boolean) as string[];
    if (candidates.length > 0) return candidates[0];
    return null;
  }

  private getImageKey(path: string) {
    const parts = path.split("/");
    const filename = parts[parts.length - 1];
    return filename.replace(/\.(png|jpe?g)$/i, "");
  }

  private getImageUrl(path: string, baseUrl: string) {
    const trimmedBase = baseUrl.replace(/\/$/, "");
    const trimmedPath = path.replace(/^\//, "");
    // Images served by API under /api/game/image/<path>
    return `${trimmedBase}/api/game/image/${trimmedPath}`;
  }

  private getPeviewImageUrl(path: string, baseUrl: string) {
    const trimmedBase = baseUrl.replace(/\/$/, "");
    const trimmedPath = path.replace(/^\//, "");
    // Images served by API under /api/game/image/<path>
    return `${trimmedBase}/api/game/image/previews/${trimmedPath}`;
  }


  async loadFromResourceBundle(bundle: GameResourceBundle) {
    const boundary = this.extractBoundary(bundle.contentType);
    if (!boundary) {
      return { success: false, stats: this.stats, loadedCount: 0, failedCount: 0 };
    }

    const parts = this.parseMultipartMixed(new Uint8Array(bundle.data), boundary);
    if (!parts.length) {
      return { success: true, stats: this.stats, loadedCount: 0, failedCount: 0 };
    }

    this.stats = initialStats();
    this.stats.loadStartTime = Date.now();

    const queueResult = this.queueLoadsFromBundle(parts);
    if (queueResult.totalQueued === 0) {
      this.finishStats();
      return {
        success: true,
        stats: this.stats,
        loadedCount: this.stats.loadedResourcesCount,
        failedCount: this.stats.failedResourcesCount,
      };
    }

    await this.startLoader();
    this.finishStats();
    const success = this.stats.failedResourcesCount === 0;
    return {
      success,
      stats: this.stats,
      loadedCount: this.stats.loadedResourcesCount,
      failedCount: this.stats.failedResourcesCount,
    };
  }

  private extractBoundary(contentType: string) {
    if (!contentType) return null;
    const match = contentType.match(/boundary=([^;]+)/i);
    if (!match) return null;
    return match[1].trim().replace(/^"|"$/g, "");
  }

  private parseMultipartMixed(data: Uint8Array, boundary: string): MultipartPart[] {
    const enc = new TextEncoder();
    const dec = new TextDecoder();
    const boundaryBytes = enc.encode(`--${boundary}`);
    const headerSep = enc.encode(`\r\n\r\n`);
    const crlf = enc.encode(`\r\n`);

    const parts: MultipartPart[] = [];
    let pos = this.indexOfBytes(data, boundaryBytes, 0);
    while (pos !== -1) {
      const afterBoundary = pos + boundaryBytes.length;
      // Final boundary: --boundary--

      if (data[afterBoundary] === 45 && data[afterBoundary + 1] === 45) {
        break;
      }

      let partStart = afterBoundary;
      if (data[partStart] === crlf[0] && data[partStart + 1] === crlf[1]) {
        partStart += 2;
      }

      const headerEnd = this.indexOfBytes(data, headerSep, partStart);
      if (headerEnd === -1) break;
      const headerText = dec.decode(data.slice(partStart, headerEnd));
      const headers: Record<string, string> = {};
      for (const line of headerText.split('\r\n')) {
        const idx = line.indexOf(':');
        if (idx === -1) continue;
        const name = line.slice(0, idx).trim().toLowerCase();
        const value = line.slice(idx + 1).trim();
        if (name) headers[name] = value;
      }

      const bodyStart = headerEnd + headerSep.length;
      const nextBoundary = this.indexOfBytes(data, boundaryBytes, bodyStart);
      if (nextBoundary === -1) break;
      let bodyEnd = nextBoundary;
      if (bodyEnd >= 2 && data[bodyEnd - 2] === crlf[0] && data[bodyEnd - 1] === crlf[1]) {
        bodyEnd -= 2;
      }

      parts.push({ headers, body: data.slice(bodyStart, bodyEnd) });
      pos = nextBoundary;
    }

    return parts;
  }

  private indexOfBytes(haystack: Uint8Array, needle: Uint8Array, start: number) {
    outer: for (let i = Math.max(0, start); i <= haystack.length - needle.length; i += 1) {
      for (let j = 0; j < needle.length; j += 1) {
        if (haystack[i + j] !== needle[j]) continue outer;
      }
      return i;
    }
    return -1;
  }

  private queueLoadsFromBundle(parts: MultipartPart[]) {
    const load = this.scene.load;
    let totalQueued = 0;

    parts.forEach((part) => {
      const contentType = part.headers['content-type'] || 'application/octet-stream';
      const key = part.headers['x-texture-key'];
      if (!key) return;

      if (this.scene.textures.exists(key)) {
        this.stats.cachedHits += 1;
        return;
      }
      if (this.loadingKeys.has(key)) return;

      const blob = new Blob([toArrayBuffer(part.body)], { type: contentType });
      const objectUrl = URL.createObjectURL(blob);

      this.loadingKeys.add(key);
      totalQueued += 1;
      this.stats.totalRequests += 1;

      load.image(key, objectUrl);
      const start = performance.now();
      load.once(`filecomplete-image-${key}`, () => {
        URL.revokeObjectURL(objectUrl);
        this.loadingKeys.delete(key);
        this.loadedResources.set(key, { path: key, isPreview: key.endsWith('-preview'), loadTime: performance.now() - start, attempts: 1 });
        this.stats.successfulLoads += 1;
        this.stats.loadedResourcesCount = this.loadedResources.size;
        if (isDebugFlagEnabled("debug.textures") && !resourceDebugSeen.has(key)) {
          resourceDebugSeen.add(key);
          // eslint-disable-next-line no-console
          console.debug("[textures] loaded", { key, contentType });
        }
      });
      load.once(`loaderror-image-${key}`, () => {
        URL.revokeObjectURL(objectUrl);
        this.loadingKeys.delete(key);
        this.stats.failedLoads += 1;
        this.stats.failedResourcesCount += 1;
        if (isDebugFlagEnabled("debug.textures") && !resourceDebugSeen.has(`err:${key}`)) {
          resourceDebugSeen.add(`err:${key}`);
          // eslint-disable-next-line no-console
          console.debug("[textures] loaderror", { key, contentType });
        }
      });
    });

    return { totalQueued };
  }
  private queueLoads(paths: string[], baseUrl: string) {
    const load = this.scene.load;
    let totalQueued = 0;
    paths.forEach((path) => {
      const key = this.getImageKey(path);
      const previewKey = `${key}-preview`;
      const cacheBust = Date.now();
      const url = `${this.getImageUrl(path, baseUrl)}?t=${cacheBust}`;
      const previewUrl = `${this.getPeviewImageUrl(path, baseUrl)}?t=${cacheBust}`;
      if (!url || !previewUrl) return;

      [
        { key, url, isPreview: false },
        { key: previewKey, url: previewUrl, isPreview: true },
      ].forEach(({ key: k, url: u, isPreview }) => {
        if (this.scene.textures.exists(k)) {
          this.stats.cachedHits += 1;
          return;
        }
        if (this.loadingKeys.has(k)) return;
        this.loadingKeys.add(k);
        totalQueued += 1;
        this.stats.totalRequests += 1;
        load.image(k, u);
        const start = performance.now();
        // Phaser emits filecomplete-<type>-<key> for per-file completion.
        load.once(`filecomplete-image-${k}`, () => {
          this.loadingKeys.delete(k);
          this.loadedResources.set(k, { path, isPreview, loadTime: performance.now() - start, attempts: 1 });
          this.stats.successfulLoads += 1;
          this.stats.loadedResourcesCount = this.loadedResources.size;
        });
        load.once(`loaderror-image-${k}`, () => {
          this.loadingKeys.delete(k);
          this.stats.failedLoads += 1;
          this.stats.failedResourcesCount += 1;
        });
      });
    });

    return { totalQueued };
  }

  private startLoader() {
    return new Promise<void>((resolve) => {
      this.scene.load.once(Phaser.Loader.Events.COMPLETE, () => resolve());
      this.scene.load.start();
    });
  }

  private finishStats() {
    this.stats.loadEndTime = Date.now();
    const start = this.stats.loadStartTime;
    const end = this.stats.loadEndTime;
    if (start !== null && end !== null) {
      const total = end - start;
      this.stats.totalLoadTime = total;
      this.stats.averageLoadTime = this.stats.totalRequests > 0 ? total / this.stats.totalRequests : total;
    }
    const totalAttempts = this.stats.successfulLoads + this.stats.failedLoads + this.stats.cachedHits;
    this.stats.successRate = totalAttempts
      ? `${((this.stats.successfulLoads / totalAttempts) * 100).toFixed(2)}%`
      : "0%";
  }
}
