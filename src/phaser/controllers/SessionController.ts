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
      const playerSelector = parsed.player;
      const hasPlayerOverride = parsed.hasPlayerOverride;
      const playerNameParam = parsed.playerName;
      const isAutoPolling = parsed.isAutoPolling;
      const aiMode = parsed.aiMode;

      if (!mode) throw new Error("Invalid mode");

      contextStore.update({ mode });
      contextStore.update({ playerSelector });
      if (gameId) contextStore.update({ gameId });

      if (mode === GameMode.Join) {
        if (!gameId) {
          throw new Error("Missing game id for join mode");
        }
        await runJoinFlow(
          { match, engine, contextStore, debugControls },
          { gameId, playerName: playerNameParam, isAutoPolling, playerSelector, hasPlayerOverride },
        );
        return;
      }

      await runHostFlow(
        { match, engine, contextStore, debugControls },
        { playerName: playerNameParam, aiMode, isAutoPolling },
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Init failed (using local fallback)";
      const normalized = msg.toLowerCase();
      const isDeckValidationError =
        normalized.includes("deck is empty") ||
        normalized.includes("unknown top deck") ||
        normalized.includes("submit deck") ||
        normalized.includes("both players must submit deck");
      if (isDeckValidationError) {
        if (typeof window !== "undefined") {
          window.alert(msg);
          window.location.href = "/setup-deck";
        }
        return;
      }
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
