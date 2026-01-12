export type AppRoute = "lobby" | "game" | "not-found";

export function getRoute(pathname: string): AppRoute {
  const path = pathname.replace(/\/+$/, "") || "/";

  if (path === "/" || path === "/lobby") return "lobby";
  if (path === "/game") return "game";
  return "not-found";
}
