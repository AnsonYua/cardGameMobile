import { useEffect, useState } from "react";
import { getRoute, type AppRoute } from "../routes";
import { GameView } from "./GameView";
import { LobbyView } from "./LobbyView";

export function Router() {
  const [route, setRoute] = useState<AppRoute>(() => getRoute(window.location.pathname));

  useEffect(() => {
    const handlePopState = () => setRoute(getRoute(window.location.pathname));
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  if (route === "game") {
    return <GameView />;
  }

  return <LobbyView isFallback={route === "not-found"} />;
}
