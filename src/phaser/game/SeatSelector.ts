export type ScenarioPlayerSelector = "currentPlayer" | "opponent";

export function normalizeScenarioPlayerSelector(raw: unknown): ScenarioPlayerSelector {
  return raw === "opponent" ? "opponent" : "currentPlayer";
}

export function resolveScenarioPlayerId(
  gameEnv: any,
  selector: ScenarioPlayerSelector,
  fallbackPlayerId: string,
): string {
  const current = typeof gameEnv?.currentPlayer === "string" ? gameEnv.currentPlayer : "";
  const p1 = typeof gameEnv?.playerId_1 === "string" ? gameEnv.playerId_1 : "";
  const p2 = typeof gameEnv?.playerId_2 === "string" ? gameEnv.playerId_2 : "";

  if (selector === "opponent") {
    if (current && p1 && p2) {
      if (current === p1) return p2;
      if (current === p2) return p1;
    }
    if (p2) return p2;
    if (p1) return p1;
  }

  if (current) return current;
  if (p1) return p1;
  if (p2) return p2;
  return fallbackPlayerId;
}
