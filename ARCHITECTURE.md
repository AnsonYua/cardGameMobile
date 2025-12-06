# Card Game Frontend – Architecture Overview

## Stack
- Vite + TypeScript
- Phaser scene for the board and UI overlays
- Lightweight API client wrapper (no state management framework)

## High-Level Flow
- `BoardScene` boots Phaser UI, reads query params for `mode` and game identifiers, and delegates session orchestration to the match layer. It maintains a local `gameContext` object for player/game identifiers and status used by the UI, and listens to `GameEngine` status previews.
- `MatchStateMachine` tracks match lifecycle (`Idle` → `CreatingRoom` → `Ready` → `InMatch`) and emits status updates for UI.
- `GameEngine` wraps status polling (`getGameStatus`) and emits `status-preview` snapshots used by the UI.
- `GameSessionService` is the boundary to the backend API: it calls `ApiManager`, caches game state, and exposes simple methods to the match layer.
- `ApiManager` builds URLs, handles fallback host resolution, and performs fetch requests (POST/GET with a localhost fallback).

## Game Modes
- **Host**: `BoardScene` -> `match.startAsHost(playerId, { playerName })` -> `session.startAsHost` -> `api.startGame`. Status moves to `WaitingOpponent` then `Ready` when the match is set to start.
- **Join**: `BoardScene` -> `match.joinRoom(gameId, playerId, playerName)`. Internally the match layer hardcodes `playerId_2` / `Demo Opponent` to align with backend expectations, performs `api.joinRoom`, and `BoardScene` triggers a follow-up `getGameStatus(gameId, playerId_2)` call (ready for future polling) while storing results in `gameContext`.

## Key Modules
- `src/phaser/BoardScene.ts`: Sets up visuals/UI, wires button handlers, parses URL params, and invokes match operations. Maintains `gameContext` (playerId, playerName, gameId, status, mode, lastStatus, previewStatus) for UI use while keeping network calls delegated to match/session layers and `GameEngine`.
- `src/phaser/game/GameEngine.ts`: Holds status snapshots, triggers `getGameStatus` via the match layer, and emits `status-preview` for consumers.
- `src/phaser/game/MatchStateMachine.ts`: Centralizes match state transitions and emits events (`status`) to listeners. Encapsulates the join/host orchestration.
- `src/phaser/game/GameSessionService.ts`: Thin stateful service that calls `ApiManager` and tracks `status`, `gameId`, and `gameMode`.
- `src/phaser/api/ApiManager.ts`: URL construction, fallback host logic, `startGame`, `joinRoom`, and `getGameStatus` (GET) wrappers.
- UI helpers under `src/phaser/ui/*` plus animation controllers under `src/phaser/animations/*` drive the visible game components.

## API Endpoints (current usage)
- `POST /api/game/player/startGame` with `{ playerId, gameConfig: { playerName } }`
- `POST /api/game/player/joinRoom` with `{ gameId, playerId, playerName }` (playerId/Name hardcoded in match layer)
- `GET /api/game/player/{playerId}?gameId={id}` used for game status (best-effort; future polling hook)

## Extending
- Add new backend calls via `ApiManager` then surface them through `GameSessionService` and `MatchStateMachine`; keep `BoardScene` UI-only.
- If more UI scenes are added, subscribe to `MatchStateMachine.events` to react to status changes without duplicating session logic.
- Prefer storing per-session IDs and mode in `GameSessionService` so state remains consistent across scene transitions.
