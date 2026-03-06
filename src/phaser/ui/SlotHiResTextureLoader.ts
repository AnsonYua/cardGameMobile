import Phaser from "phaser";

const DEFAULT_FAIL_COOLDOWN_MS = 30_000;
const SLOT_HIRES_PREFIX = "slot-hires-v2-";

type TextureResolverParams = {
  hiResTextureKey?: string;
  baseTextureKey?: string;
  hasTexture: (key: string) => boolean;
};

type SlotHiResTextureLoaderOptions = {
  baseUrl?: string;
  fetchFn?: typeof fetch;
  nowFn?: () => number;
  failCooldownMs?: number;
};

export function deriveSetIdFromCardId(cardId?: string | null) {
  if (!cardId) return null;
  const normalized = String(cardId).trim();
  const separatorIndex = normalized.indexOf("-");
  if (separatorIndex <= 0) return null;
  const prefix = normalized.slice(0, separatorIndex).trim();
  if (!/^[A-Za-z0-9]+$/.test(prefix)) return null;
  return prefix.toLowerCase();
}

export function buildSlotHiResTextureKey(cardId: string) {
  return `${SLOT_HIRES_PREFIX}${cardId}`;
}

export function buildSlotHiResCandidateUrls(baseUrl: string, setId: string, cardId: string) {
  const root = baseUrl.replace(/\/+$/, "");
  const withBase = (path: string) => (root ? `${root}${path}` : path);
  return [
    withBase(`/api/game/image/${setId}/${cardId}.png`),
    withBase(`/api/game/image/${setId}/${cardId}.jpeg`),
    withBase(`/api/game/image/${cardId}.png`),
    withBase(`/api/game/image/${cardId}.jpeg`),
  ];
}

export function resolveSlotTextureKey({ hiResTextureKey, baseTextureKey, hasTexture }: TextureResolverParams) {
  if (hiResTextureKey && hasTexture(hiResTextureKey)) return hiResTextureKey;
  if (baseTextureKey && hasTexture(baseTextureKey)) return baseTextureKey;
  return hiResTextureKey ?? baseTextureKey;
}

export class SlotHiResTextureLoader {
  private successCache = new Map<string, string>();
  private failedCache = new Map<string, number>();
  private inFlight = new Map<string, Promise<string | null>>();
  private fetchFn: typeof fetch;
  private nowFn: () => number;
  private failCooldownMs: number;
  private baseUrl: string;
  private destroyed = false;

  constructor(
    private scene: Phaser.Scene,
    options: SlotHiResTextureLoaderOptions = {},
  ) {
    this.fetchFn = options.fetchFn ?? fetch;
    this.nowFn = options.nowFn ?? Date.now;
    this.failCooldownMs = options.failCooldownMs ?? DEFAULT_FAIL_COOLDOWN_MS;
    this.baseUrl = this.resolveBaseUrl(options.baseUrl);
  }

  getLoadedKey(cardId?: string) {
    if (!cardId) return undefined;
    const cached = this.successCache.get(cardId);
    if (cached && this.scene.textures.exists(cached)) return cached;
    if (cached) this.successCache.delete(cardId);
    const key = buildSlotHiResTextureKey(cardId);
    if (this.scene.textures.exists(key)) {
      this.successCache.set(cardId, key);
      return key;
    }
    return undefined;
  }

  async ensureLoaded(cardId?: string): Promise<string | null> {
    if (!cardId || this.destroyed) return null;
    const existing = this.getLoadedKey(cardId);
    if (existing) return existing;

    const setId = deriveSetIdFromCardId(cardId);
    if (!setId) return null;

    const lastFailedAt = this.failedCache.get(cardId);
    if (typeof lastFailedAt === "number" && this.nowFn() - lastFailedAt < this.failCooldownMs) {
      return null;
    }

    const pending = this.inFlight.get(cardId);
    if (pending) return pending;

    const task = this.tryLoad(cardId, setId).finally(() => {
      this.inFlight.delete(cardId);
    });
    this.inFlight.set(cardId, task);
    return task;
  }

  destroy() {
    this.destroyed = true;
    this.inFlight.clear();
    this.successCache.clear();
    this.failedCache.clear();
  }

  private async tryLoad(cardId: string, setId: string): Promise<string | null> {
    const textureKey = buildSlotHiResTextureKey(cardId);
    const candidateUrls = buildSlotHiResCandidateUrls(this.baseUrl, setId, cardId);
    for (const url of candidateUrls) {
      if (this.destroyed) return null;
      try {
        const response = await this.fetchFn(url, { cache: "no-store" });
        if (!response?.ok) continue;
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        try {
          const loaded = await this.loadTextureFromObjectUrl(textureKey, objectUrl);
          if (!loaded) continue;
          this.successCache.set(cardId, textureKey);
          this.failedCache.delete(cardId);
          return textureKey;
        } finally {
          URL.revokeObjectURL(objectUrl);
        }
      } catch {
        // Continue trying the remaining candidate URLs.
      }
    }
    this.failedCache.set(cardId, this.nowFn());
    return null;
  }

  private loadTextureFromObjectUrl(key: string, objectUrl: string): Promise<boolean> {
    if (this.scene.textures.exists(key)) return Promise.resolve(true);
    const load = this.scene.load;
    return new Promise((resolve) => {
      let settled = false;
      const finalize = (loaded: boolean) => {
        if (settled) return;
        settled = true;
        load.off(`filecomplete-image-${key}`, onComplete);
        load.off(`loaderror-image-${key}`, onError);
        resolve(loaded);
      };
      const onComplete = () => finalize(true);
      const onError = () => finalize(false);
      load.once(`filecomplete-image-${key}`, onComplete);
      load.once(`loaderror-image-${key}`, onError);
      load.image(key, objectUrl);
      const loadIsLoading =
        typeof (load as any).isLoading === "function"
          ? (load as any).isLoading()
          : Boolean((load as any).isLoading);
      if (!loadIsLoading) {
        load.start();
      }
    });
  }

  private resolveBaseUrl(baseUrl?: string) {
    const explicit = typeof baseUrl === "string" ? baseUrl.trim() : "";
    if (explicit) return explicit.replace(/\/+$/, "");
    if (typeof window !== "undefined" && typeof window.location?.origin === "string") {
      return window.location.origin.replace(/\/+$/, "");
    }
    return "";
  }
}
