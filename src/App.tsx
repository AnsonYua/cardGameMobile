import { GameView } from "./components/GameView";
import { LobbyView } from "./components/LobbyView";

function App() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  const isGameRoute = path === "/game";
  const isLobbyRoute = path === "/" || path === "/lobby";

  if (isGameRoute) {
    return <GameView />;
  }

  return <LobbyView isFallback={!isLobbyRoute} />;
}

export default App;
