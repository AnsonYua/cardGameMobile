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

  return {
    mode: mode ?? GameMode.Host,
    gameId: params.get("gameId") || params.get("roomid"),
    playerId: params.get("playerId") || params.get("playerid"),
    playerName: params.get("playerName") || params.get("playername"),
  };
}
