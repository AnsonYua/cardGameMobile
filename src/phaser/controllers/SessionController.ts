import { GameMode, GameStatus } from "../game/GameSessionService";
import type { GameEngine } from "../game/GameEngine";
import type { MatchStateMachine } from "../game/MatchStateMachine";
import type { GameContextStore } from "../game/GameContextStore";
import { parseSessionParams } from "../game/SessionParams";
import type { DebugControls } from "./DebugControls";
import { runHostFlow, runJoinFlow } from "./sessionFlows";

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
      const joinTokenParam = parsed.joinToken;
      const isAutoPolling = parsed.isAutoPolling;
      const aiMode = parsed.aiMode;

      if (!mode) throw new Error("Invalid mode");

      contextStore.update({ mode });
      if (playerIdParam) contextStore.update({ playerId: playerIdParam });
      if (gameId) contextStore.update({ gameId });

      if (mode === GameMode.Join) {
        if (!gameId) {
          throw new Error("Missing game id for join mode");
        }
        if (!joinTokenParam) {
          throw new Error("Missing join token for join mode");
        }
        await runJoinFlow(
          { match, engine, contextStore, debugControls },
          { gameId, joinToken: joinTokenParam, playerName: playerNameParam, isAutoPolling },
        );
        return;
      }

      await runHostFlow(
        { match, engine, contextStore, debugControls },
        { playerName: playerNameParam, aiMode, isAutoPolling },
      );
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
    }
  }
}
