export class SnapshotCache<T> {
  private entries = new Map<string, { snapshot: T; savedAt: number }>();

  constructor(private config: { ttlMs: number; maxEntries: number }) {}

  get(key: string) {
    return this.entries.get(key)?.snapshot;
  }

  set(key: string, snapshot: T) {
    const existing = this.entries.get(key)?.snapshot;
    this.entries.set(key, { snapshot, savedAt: Date.now() });
    this.trim();
    return existing;
  }

  delete(key: string) {
    const existing = this.entries.get(key)?.snapshot;
    this.entries.delete(key);
    return existing;
  }

  evictExpired(now = Date.now()) {
    const ttl = this.config.ttlMs;
    this.entries.forEach((entry, key) => {
      if (now - entry.savedAt > ttl) {
        this.entries.delete(key);
      }
    });
  }

  private trim() {
    while (this.entries.size > this.config.maxEntries) {
      const oldestKey = this.entries.keys().next().value;
      if (!oldestKey) break;
      this.entries.delete(oldestKey);
    }
  }
}

export class ProcessedIdCache {
  private ids = new Set<string>();

  constructor(private maxEntries: number) {}

  clear() {
    this.ids.clear();
  }

  has(id: string) {
    return this.ids.has(id);
  }

  add(id: string) {
    this.ids.add(id);
    if (this.ids.size <= this.maxEntries) return;
    const oldestKey = this.ids.values().next().value;
    if (oldestKey) {
      this.ids.delete(oldestKey);
    }
  }
}
