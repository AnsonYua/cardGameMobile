import { GameStatus } from "../game/GameSessionService";

export const formatHeaderStatus = (status: any, opts?: { offlineFallback?: boolean }) => {
  if (status === null || status === undefined || typeof status === "object") return null;
  const suffix = opts?.offlineFallback ? " (offline)" : "";
  let label: string;
  if (status === GameStatus.LoadingResources) {
    label = "Loading...";
  } else if (status === GameStatus.InMatch) {
    label = "In match";
  } else if (status === GameStatus.Ready) {
    label = "Ready";
  } else if (status === "Action Step" || status === "ACTION_STEP" || status === "action_step") {
    label = "Action Step";
  } else if (typeof status === "string") {
    const normalized = status.replace(/_/g, " ").toLowerCase();
    label = normalized.charAt(0).toUpperCase() + normalized.slice(1);
  } else {
    label = "Status";
  }
  return `Status: ${label}${suffix}`;
};
