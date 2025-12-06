import Phaser from "phaser";
import type { GameStatusResponse } from "./GameTypes";

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

  async loadFromGameStatus(gameStatus: GameStatusResponse) {
    const decks = gameStatus?.decks as any;
    if (!decks) return { success: true, stats: this.stats, loadedCount: 0, failedCount: 0 };

    const cardPaths = this.collectCardPaths(decks);
    if (!cardPaths.length) return { success: true, stats: this.stats, loadedCount: 0, failedCount: 0 };

    this.stats = initialStats();
    this.stats.loadStartTime = Date.now();

    const queueResult = this.queueLoads(cardPaths);
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
    return path.endsWith(".png") ? path : `${path}.png`;
  }

  private getImageKey(path: string) {
    const parts = path.split("/");
    const filename = parts[parts.length - 1];
    return filename.replace(/\.png$/i, "");
  }

  private getImageUrl(path: string) {
    // Default to same-origin assets path; adjust as backend specifies.
    const base = window.location.origin;
    return `${base}/assets/cards/${path}`;
  }

  private queueLoads(paths: string[]) {
    const load = this.scene.load;
    let totalQueued = 0;
    paths.forEach((path) => {
      const key = this.getImageKey(path);
      const previewKey = `${key}-preview`;
      const url = `${this.getImageUrl(path)}?t=${Date.now()}`;
      const previewUrl = `${this.getImageUrl(path)}?preview=1&t=${Date.now()}`;

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
        load.once(`${Phaser.Loader.Events.FILE_COMPLETE}-${k}`, () => {
          this.loadingKeys.delete(k);
          this.loadedResources.set(k, { path, isPreview, loadTime: performance.now() - start, attempts: 1 });
          this.stats.successfulLoads += 1;
          this.stats.loadedResourcesCount = this.loadedResources.size;
        });
        load.once(`${Phaser.Loader.Events.FILE_LOAD_ERROR}-${k}`, () => {
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
    if (this.stats.loadStartTime !== null && this.stats.loadEndTime !== null) {
      this.stats.totalLoadTime = this.stats.loadEndTime - this.stats.loadStartTime;
      this.stats.averageLoadTime =
        this.stats.totalRequests > 0 ? this.stats.totalLoadTime / this.stats.totalRequests : this.stats.totalLoadTime;
    }
    const totalAttempts = this.stats.successfulLoads + this.stats.failedLoads + this.stats.cachedHits;
    this.stats.successRate = totalAttempts
      ? `${((this.stats.successfulLoads / totalAttempts) * 100).toFixed(2)}%`
      : "0%";
  }
}
