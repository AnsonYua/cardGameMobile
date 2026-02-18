import { GameMode } from "./GameSessionService";
import { normalizeScenarioPlayerSelector, type ScenarioPlayerSelector } from "./SeatSelector";

export type ParsedSessionParams = {
  mode: GameMode;
  gameId: string | null;
  player: ScenarioPlayerSelector;
  hasPlayerOverride: boolean;
  playerName: string | null;
  joinToken: string | null;
  isAutoPolling: boolean;
  aiMode: boolean;
};

export function parseSessionParams(locationSearch: string): ParsedSessionParams {
  const params = new URLSearchParams(locationSearch);
  const rawMode = params.get("mode");
  const mode = rawMode === "join" ? GameMode.Join : rawMode === "host" ? GameMode.Host : undefined;
  const rawPlayer = params.get("player");
  const player: ScenarioPlayerSelector = normalizeScenarioPlayerSelector(rawPlayer);

  // Accept multiple casings/aliases to stay compatible with shared links.
  const getParam = (keys: string[]) => {
    for (const key of keys) {
      const value = params.get(key);
      if (value) return value;
    }
    return null;
  };

  return {
    mode: mode ?? GameMode.Host,
    gameId: getParam(["gameId", "gameid", "roomid"]),
    player,
    hasPlayerOverride: rawPlayer !== null,
    playerName: getParam(["playerName", "playername"]),
    joinToken: getParam(["joinToken", "jointoken"]),
    isAutoPolling: getParam(["isAutoPolling", "isautopolling"]) === "true" || getParam(["isAutoPolling", "isautopolling"]) === "1",
    aiMode: getParam(["aimode", "aiMode"]) === "true" || getParam(["aimode", "aiMode"]) === "1",
  };
}
