export type AppRoute = "lobby" | "game" | "setup-deck" | "not-found";

export function getRoute(pathname: string): AppRoute {
  const path = pathname.replace(/\/+$/, "") || "/";

  if (path === "/" || path === "/lobby") return "lobby";
  if (path === "/game") return "game";
  if (path === "/setup-deck") return "setup-deck";
  return "not-found";
}
