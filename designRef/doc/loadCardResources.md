# ResourceManager.loadCardResources reference

How the Phaser client pulls deck assets from the API and prepares them for play. Use this as a migration checklist when moving the loader to another project.

## Purpose and prerequisites
- Central entry point for dynamic card asset loading in `src/managers/ResourceManager.js`.
- Assumes `GAME_CONFIG.api` is configured (base URL, endpoints, headers, timeout).
- Runs inside a Phaser scene that exposes `load` so textures can be registered.
- Statistics (`this.stats`) track timings, successes, failures, and cache hits for observability.

## End-to-end workflow
1. **Start tracking** – Capture `loadStartTime` and log the beginning of the flow.
2. **Fetch deck data** – `fetchDeckData()` calls `GET ${GAME_CONFIG.api.baseUrl}${GAME_CONFIG.api.endpoints.gameResource}` with `Accept`, `Content-Type`, and `Cache-Control` headers and a 10s timeout. Retries are handled by `makeRequest()` using `retryAttempts`/`retryDelay`.
3. **Parse deck payload** – `extractCardPaths()` walks `deckData.decks.*.cards`, normalizes file extensions to `.png`, and deduplicates paths so each texture loads once.
4. **Queue image loads** – `loadCardImages()` creates two load jobs per card: the full image (`getImageUrl`) and a preview (`getPreviewImageUrl`, suffixed with `-preview` as the texture key). A cache-busting `?t=<timestamp>` is appended. Already-loaded keys short-circuit and increment `cachedHits`.
5. **Run Phaser loader** – `scene.load.start()` kicks off the queued requests. `Promise.allSettled` collects results while `loadSingleImage()` handles retries and marks successes/failures.
6. **Record stats and return** – On completion, set `loadEndTime`, derive `averageLoadTime` (total time divided by `totalRequests`), log a summary, and return `{ success, stats, loadedCount, failedCount }`. Errors bubble up with `loadEndTime` still recorded for timing.

## Request/response contract
- **Request**
  - Method: `GET`
  - URL: `http://localhost:8080/api/game/player/gameResource` (by default)
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
