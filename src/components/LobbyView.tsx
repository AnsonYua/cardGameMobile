type LobbyViewProps = {
  isFallback?: boolean;
};

export function LobbyView({ isFallback = false }: LobbyViewProps) {
  return (
    <div className="page">
      <div className="lobby">
        <h1>Lobby</h1>
        <p>Placeholder scene. Hook up matchmaking or room selection here.</p>
        {isFallback ? (
          <p>Unknown route. Try <a href="/lobby">/lobby</a> or <a href="/game">/game</a>.</p>
        ) : (
          <p>
            Launch the game at <a href="/game">/game</a>.
          </p>
        )}
      </div>
    </div>
  );
}
