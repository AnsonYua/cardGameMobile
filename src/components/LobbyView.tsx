import { useEffect, useMemo, useState } from "react";
import { ApiManager, type LobbyRoomSummary } from "../phaser/api/ApiManager";
import { requestJoinToken } from "./JoinTokenPrompt";

type LobbyViewProps = {
  isFallback?: boolean;
};

type LobbyStatus = "idle" | "loading" | "error";

const POLL_INTERVAL_MS = 7000;

const formatTimestamp = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

export function LobbyView({ isFallback = false }: LobbyViewProps) {
  const api = useMemo(() => new ApiManager(), []);
  const [rooms, setRooms] = useState<LobbyRoomSummary[]>([]);
  const [status, setStatus] = useState<LobbyStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  useEffect(() => {
    let isActive = true;

    const loadLobbyList = async () => {
      try {
        setStatus((prev) => (prev === "idle" ? "loading" : prev));
        const response = await api.getLobbyList();
        if (!isActive) return;
        setRooms(Array.isArray(response.rooms) ? response.rooms : []);
        setErrorMessage(null);
        setStatus("idle");
      } catch (err) {
        if (!isActive) return;
        setStatus("error");
        setErrorMessage(err instanceof Error ? err.message : "Unable to load rooms.");
      }
    };

    loadLobbyList();
    const interval = window.setInterval(loadLobbyList, POLL_INTERVAL_MS);

    return () => {
      isActive = false;
      window.clearInterval(interval);
    };
  }, [api]);

  const handleJoin = async (gameId: string) => {
    setJoiningId(gameId);
    setErrorMessage(null);
    try {
      const joinToken = requestJoinToken();
      if (!joinToken) {
        setJoiningId(null);
        return;
      }
      const params = new URLSearchParams({
        mode: "join",
        gameId,
        joinToken: joinToken.trim(),
        isAutoPolling: "true",
      });
      window.location.href = `/game?${params.toString()}`;
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Unable to join room.");
      setJoiningId(null);
    }
  };

  return (
    <div className="page">
      <div className="lobby">
        <div className="lobby-header">
          <h1>Lobby</h1>
          <span className="lobby-subtitle">Live rooms update automatically.</span>
          <div className="lobby-actions-row">
            <button className="lobby-create-button" type="button">
              Setup deck
            </button>
            <button
              className="lobby-create-button"
              type="button"
              onClick={() => {
                const params = new URLSearchParams({
                  mode: "host",
                  aimode: "true",
                  isAutoPolling: "true",
                });
                window.location.href = `/game?${params.toString()}`;
              }}
            >
              Player with AI
            </button>
          </div>
          <button
            className="lobby-create-button lobby-create-full"
            type="button"
            onClick={() => {
              const params = new URLSearchParams({
                mode: "host",
                isAutoPolling: "true",
              });
              window.location.href = `/game?${params.toString()}`;
            }}
          >
            Create Room
          </button>
        </div>
        {status === "error" && <p className="lobby-error">{errorMessage}</p>}
        {rooms.length === 0 ? (
          <div className="lobby-empty">
            <p>No rooms are waiting right now.</p>
            <span>Create one from the host flow and it will appear here.</span>
          </div>
        ) : (
          <div className="lobby-list">
            {rooms.map((room) => (
              <div key={room.gameId} className="lobby-card">
                <div className="lobby-card-info">
                  <span className="lobby-card-title">{room.gameId}</span>
                  <span className="lobby-card-meta">{formatTimestamp(room.createdAt)}</span>
                </div>
                <button
                  className="lobby-join-button"
                  type="button"
                  onClick={() => handleJoin(room.gameId)}
                  disabled={joiningId === room.gameId}
                >
                  {joiningId === room.gameId ? "Joining..." : "Join"}
                </button>
              </div>
            ))}
          </div>
        )}
        {isFallback ? (
          <p className="lobby-footnote">
            Unknown route. Try <a href="/lobby">/lobby</a> or <a href="/game">/game</a>.
          </p>
        ) : (
          <p className="lobby-footnote">
            Launch the game at <a href="/game">/game</a>.
          </p>
        )}
      </div>
    </div>
  );
}
