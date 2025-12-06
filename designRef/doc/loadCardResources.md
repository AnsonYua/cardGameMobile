# Card resource loading requirements

How a Phaser-based client should pull deck assets from an API and prepare them for play. Use this as a migration checklist when re-implementing the loader in a new project.

## Purpose and prerequisites
- Provide a single entry point that fetches deck data, deduplicates card assets, loads full and preview images, and tracks stats.
- Require API configuration (base URL, endpoints, headers, timeout) plus preview/full image URL helpers.
- Execute inside a Phaser scene that exposes `load` and `textures`.
- Maintain statistics on timings, successes, failures, retries, and cache hits for observability.

## End-to-end workflow
1. **Start tracking** – Capture `loadStartTime` and log the beginning of the flow.
2. **Fetch deck data** – Call `GET <baseUrl><gameResourceEndpoint>` with JSON headers and a timeout. Retries respect `retryAttempts`/`retryDelay`.
3. **Parse deck payload** – Walk `deckData.decks.*.cards`, normalize file extensions to `.png`, and deduplicate paths so each texture loads once.
4. **Queue image loads** – Create two load jobs per card: the full image (`getImageUrl`) and a preview (`getPreviewImageUrl`, suffixed with `-preview` as the texture key). Append a cache-busting `?t=<timestamp>`. Already-loaded keys short-circuit and increment `cachedHits`.
5. **Run Phaser loader** – `scene.load.start()` kicks off queued requests. `Promise.allSettled` collects results while per-image retry logic marks successes/failures.
6. **Record stats and return** – On completion, set `loadEndTime`, derive `averageLoadTime` (total time divided by `totalRequests`), log a summary, and return `{ success, stats, loadedCount, failedCount }`. Errors bubble up with `loadEndTime` still recorded for timing.

## Request/response contract
- **Request**
  - Method: `GET`
  - URL: `<baseUrl><gameResourceEndpoint>`
  - Headers: `Accept: application/json`, `Content-Type: application/json`, `Cache-Control: no-cache`
  - Timeout: `GAME_CONFIG.api.timeout` (10s default)
- **Response (expected shape)**
  ```json
  {
    "decks": {
      "playerDeck": {
        "cards": [
          "st01/ST01-001.png",
          "st01/ST01-002",          // extension added automatically
          "st01/ST01-003.png"
        ]
      },
      "opponentDeck": {
        "cards": [
          "EXB-001.png",
          "EXR-001.png"
        ]
      }
    }
  }
  ```
  - `decks` is required; missing or empty decks short-circuit the loader with no requests.
  - Card entries may omit `.png`; the loader appends it.

## Key behaviors to keep when migrating
- **Retry & timeout** – All network calls respect `retryAttempts`, `retryDelay`, and `timeout` to avoid hanging the scene.
- **Preview support** – Every card loads a matching preview texture with `-preview` suffix; downstream UI expects both.
- **Statistics** – Preserve `stats` fields (`totalRequests`, `successfulLoads`, `failedLoads`, `cachedHits`, timing) for debugging and telemetry.
- **Cache awareness** – Prevent duplicate loads by checking `loadedResources` and `loadingPromises` before enqueuing.
- **Logging hook** – `log()` gate-keeps console output via `config.enableLogging`; keep this switch to silence logs in production.

## How Phaser stores resources and how to use them
- Loaded images are registered as textures in the active scene’s `TextureManager` (`scene.textures`). Each image key becomes a reusable texture entry.
- Full images use `getImageKey(imagePath)`, which strips directories and extensions (e.g., `st01/ST01-001.png` → `ST01-001`). Preview textures append `-preview` to that key (e.g., `ST01-001-preview`).
- `loadedResources` Map keeps metadata (`path`, `isPreview`, `loadTime`, `attempts`) for inspection; `isResourceLoaded(imageKey)` and `getResourceInfo(imageKey)` query this cache.

### Retrieving textures in a scene
```js
// Assuming resourceManager.loadCardResources() already ran
const cardKey = 'ST01-001'; // full-size texture key
const previewKey = `${cardKey}-preview`;

// Create a sprite with the full image
const sprite = this.add.image(200, 200, cardKey);

// Use the preview for a thumbnail
const thumb = this.add.image(400, 200, previewKey).setScale(0.5);

// Check if a texture exists before use
if (!this.textures.exists(cardKey)) {
  console.warn(`Missing texture: ${cardKey}`);
}
```

### Accessing the texture object directly
```js
const texture = this.textures.get(cardKey);
if (texture) {
  const frameNames = texture.getFrameNames(); // inspect available frames
  // use texture.frames[...] if needed
}
```

### Preloading specific cards
```js
await resourceManager.preloadCards([
  'st01/ST01-001.png',
  'st01/ST01-002.png'
]);

if (resourceManager.isResourceLoaded('ST01-001')) {
  this.add.image(300, 300, 'ST01-001');
}
```

### Verifying loads and stats
```js
const { successRate, failedResourcesCount } = resourceManager.getStats();
console.log(`Textures ready. Success rate: ${successRate}, failures: ${failedResourcesCount}`);
```

## Typical return payload
```json
{
  "success": true,
  "stats": {
    "totalRequests": 40,
    "successfulLoads": 38,
    "failedLoads": 2,
    "cachedHits": 0,
    "loadStartTime": 1710000000000,
    "loadEndTime": 1710000002450,
    "averageLoadTime": 61.25,
    "loadedResourcesCount": 38,
    "failedResourcesCount": 2,
    "activeLoadingCount": 0,
    "totalLoadTime": 2450,
    "successRate": "95.00%"
  },
  "loadedCount": 38,
  "failedCount": 2
}
```
- Non-200 responses or exhausted retries throw; caller should handle errors while noting `stats.loadEndTime` is always set.
