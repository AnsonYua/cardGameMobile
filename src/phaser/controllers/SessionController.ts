import type { GameStatusResponse } from "../game/GameTypes";
import { GameMode, GameStatus } from "../game/GameSessionService";
import type { GameEngine } from "../game/GameEngine";
import type { MatchStateMachine } from "../game/MatchStateMachine";
import type { GameContextStore } from "../game/GameContextStore";
import { parseSessionParams } from "../game/SessionParams";
import type { DebugControls } from "./DebugControls";

export class SessionController {
  constructor(
    private deps: {
      match: MatchStateMachine;
      engine: GameEngine;
      contextStore: GameContextStore;
      debugControls?: DebugControls;
      onOfflineFallback: (gameId: string, message: string) => void;
    },
  ) {}

  async initSession(locationSearch: string) {
    const { match, engine, contextStore, debugControls } = this.deps;
    try {
      const parsed = parseSessionParams(locationSearch);
      const mode = parsed.mode;
      const gameId = parsed.gameId;
      const playerIdParam = parsed.playerId;
      const playerNameParam = parsed.playerName;
      const isAutoPolling = parsed.isAutoPolling;

      if (!mode) throw new Error("Invalid mode");

      contextStore.update({ mode });
      if (playerIdParam) contextStore.update({ playerId: playerIdParam });
      if (gameId) contextStore.update({ gameId });

      const context = contextStore.get();
      if (mode === GameMode.Join) {
        if (!gameId) {
          throw new Error("Missing game id for join mode");
        }
        // Default join identity aligns with backend sample if none provided.
        const joinId = playerIdParam || "playerId_2";
        const joinName = playerNameParam || "Demo Opponent";
        contextStore.update({ playerId: joinId, playerName: joinName });
        await match.joinRoom(gameId, joinId, joinName);
        const resolvedPlayerId = contextStore.get().playerId || joinId;
        const statusPayload = (await match.getGameStatus(gameId, resolvedPlayerId)) as GameStatusResponse;
        await engine.loadGameResources(gameId, resolvedPlayerId, statusPayload);
        await engine.updateGameStatus(gameId, resolvedPlayerId, {
          fromScenario: true,
          silent: true,
          statusPayload,
        });
        if (isAutoPolling) {
          await debugControls?.startAutoPolling();
        }
        return;
      }

      const hostName = playerNameParam || context.playerName || "Demo Player";
      contextStore.update({ playerName: hostName });
      await match.startAsHost(context.playerId, { playerName: hostName });
      const state = match.getState();
      if (state.gameId) {
        contextStore.update({ gameId: state.gameId });
      }
      if (isAutoPolling) {
        await debugControls?.startAutoPolling();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Init failed (using local fallback)";
      const context = contextStore.get();
      const params = new URLSearchParams(locationSearch);
      const fallbackGameId =
        context.mode === GameMode.Join
          ? params.get("gameId") || params.get("roomid") || "join-local"
          : `demo-${Date.now()}`;
      contextStore.update({ gameId: fallbackGameId });
      this.deps.onOfflineFallback(fallbackGameId, msg);
      console.warn("Using offline fallback:", msg);
    }
  }
}
