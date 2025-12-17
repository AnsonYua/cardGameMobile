import { GameMode } from "./GameSessionService";

export type ParsedSessionParams = {
  mode: GameMode;
  gameId: string | null;
  playerId: string | null;
  playerName: string | null;
};

export function parseSessionParams(locationSearch: string): ParsedSessionParams {
  const params = new URLSearchParams(locationSearch);
  const rawMode = params.get("mode");
  const mode = rawMode === "join" ? GameMode.Join : rawMode === "host" ? GameMode.Host : undefined;

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
    playerId: getParam(["playerId", "playerid"]),
    playerName: getParam(["playerName", "playername"]),
  };
}
