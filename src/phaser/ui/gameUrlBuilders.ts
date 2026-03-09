export type BuildGameUrlOptions = {
  base?: string;
  gameId: string;
  joinToken?: string;
  isAutoPolling?: boolean;
  player?: "currentPlayer" | "opponent";
  allowSeatSessionFallback?: boolean;
};

const resolveBaseOrigin = (base?: string): string =>
  base ?? (typeof window !== "undefined" && window.location?.origin ? window.location.origin : "http://localhost:5173");

export function buildGameUrl(opts: BuildGameUrlOptions): string {
  const url = new URL("/game", resolveBaseOrigin(opts.base));
  url.searchParams.set("mode", "join");
  url.searchParams.set("gameId", opts.gameId);
  url.searchParams.set("isAutoPolling", String(opts.isAutoPolling ?? true));
  if (opts.player) {
    url.searchParams.set("player", opts.player);
  }
  if (opts.allowSeatSessionFallback) {
    url.searchParams.set("allowSeatSessionFallback", "1");
  }
  if (opts.joinToken) {
    url.searchParams.set("joinToken", opts.joinToken);
  }
  return url.toString();
}

export function buildLobbyJoinUrl(opts: Omit<BuildGameUrlOptions, "player" | "allowSeatSessionFallback">): string {
  return buildGameUrl(opts);
}

export function buildScenarioSeatUrl(
  opts: Omit<BuildGameUrlOptions, "joinToken"> & { player: "currentPlayer" | "opponent" },
): string {
  return buildGameUrl({
    ...opts,
    allowSeatSessionFallback: true,
  });
}
