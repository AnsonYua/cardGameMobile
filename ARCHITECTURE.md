# Card Game Frontend – Architecture Overview

## Stack
- Vite + TypeScript
- Phaser scene for the board and UI overlays
- Lightweight API client wrapper (no state management framework)

## High-Level Flow
- `BoardScene` boots Phaser UI, reads query params for `mode` and game identifiers (via `SessionParams` helper), and delegates session orchestration to the match layer. It reads/writes shared `GameContext` from `GameContextStore` for UI use and listens to status/phase events from `GameEngine`.
- `MatchStateMachine` tracks match lifecycle (`Idle` → `CreatingRoom` → `Ready` → `InMatch`) and emits status updates for UI.
- `GameEngine` wraps status polling (`getGameStatus`), derives status from the response, emits `engine:status` snapshots (derived plus raw payload), and surfaces phase transitions (e.g., `engine:phase:redraw`).
- `GameSessionService` is the boundary to the backend API: it calls `ApiManager`, caches game state, and exposes simple methods to the match layer.
- `ApiManager` builds URLs, handles fallback host resolution, and performs fetch requests (POST/GET with a localhost fallback).
- `GameContextStore` holds shared game identifiers/status for the current session.
- `SessionParams` parses URL query params into structured session info.
- `UIVisibilityController` centralizes show/hide/fade behaviour for core controls; `DebugControls` encapsulates test-only popup handlers.
- `HandPresenter` maps `gameEnv` payloads to hand view models and shares preview key creation with `HandAreaHandler` via `HandTypes`.

## Game Modes
- **Host**: `BoardScene` -> `match.startAsHost(playerId, { playerName })` -> `session.startAsHost` -> `api.startGame`. Status moves to `WaitingOpponent` then `Ready` when the match is set to start.
- **Join**: `BoardScene` -> `match.joinRoom(gameId, playerId, playerName)`. Internally the match layer hardcodes `playerId_2` / `Demo Opponent` to align with backend expectations, performs `api.joinRoom`, and `BoardScene` triggers a follow-up `getGameStatus(gameId, playerId_2)` call (ready for future polling) while storing results in `gameContext`.

## Key Modules
- `src/phaser/BoardScene.ts`: Sets up visuals/UI, wires button handlers, uses `SessionParams` for query parsing, delegates match operations, and consumes shared `gameContext` from `GameContextStore` while reacting to `GameEngine` status/phase events.
- `src/phaser/game/GameEngine.ts`: Holds polling logic, derives status snapshots, and emits `engine:status` plus phase events.
- `src/phaser/game/MatchStateMachine.ts`: Centralizes match state transitions and emits events (`status`) to listeners. Encapsulates the join/host orchestration.
- `src/phaser/game/GameSessionService.ts`: Thin stateful service that calls `ApiManager` and tracks `status`, `gameId`, and `gameMode`.
- `src/phaser/api/ApiManager.ts`: URL construction, fallback host logic, `startGame`, `joinRoom`, and `getGameStatus` (GET) wrappers.
- `src/phaser/game/SessionParams.ts`: Parses query params for mode/game/player identifiers.
- `src/phaser/game/GameContextStore.ts`: Shared game context (playerId, playerName, gameId, status, mode, lastStatus).
- `src/phaser/game/GameTypes.ts`: Shared status/phase types for polling responses.
- `src/phaser/game/EngineEvents.ts`: Constants for engine event names (`engine:status`, `engine:phase:redraw`, `engine:status-error`).
- `src/phaser/ui/UIVisibilityController.ts`: Centralized show/hide for board UI controls.
- `src/phaser/controllers/DebugControls.ts`: Debug/test popup wiring for manual join/poll actions.
- `src/phaser/ui/HandPresenter.ts`: Translates `gameEnv.players[playerId].deck.hand` into view-friendly card data (preview texture keys).
- `src/phaser/ui/HandTypes.ts`: Shared hand card view types and preview key helper.
- UI helpers under `src/phaser/ui/*` plus animation controllers under `src/phaser/animations/*` drive the visible game components.
- Layout constants live in `src/config/gameLayout.ts` (hand area sizes, gaps, aspect ratio) to keep UI math consistent and out of renderers.
- `HandAreaHandler` renders the hand using the shared constants and compact helpers (cost badge, AP|HP badge) to mirror base/shield styling without inflating `BoardScene`.

## API Endpoints (current usage)
- `POST /api/game/player/startGame` with `{ playerId, gameConfig: { playerName } }`
- `POST /api/game/player/joinRoom` with `{ gameId, playerId, playerName }` (playerId/Name hardcoded in match layer)
- `GET /api/game/player/{playerId}?gameId={id}` used for game status (best-effort; future polling hook)

## Extending
- Add new backend calls via `ApiManager` then surface them through `GameSessionService` and `MatchStateMachine`; keep `BoardScene` UI-only.
- If more UI scenes are added, subscribe to `MatchStateMachine.events` to react to status changes without duplicating session logic.
- Prefer storing per-session IDs and mode in `GameSessionService` so state remains consistent across scene transitions.
