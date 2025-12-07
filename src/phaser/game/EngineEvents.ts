export const ENGINE_EVENTS = {
  STATUS: "engine:status",
  STATUS_ERROR: "engine:status-error",
  PHASE_REDRAW: "engine:phase:redraw",
  GAME_RESOURCE: "engine:game-resource",
  MAIN_PHASE_UPDATE:"engine:general-update",
  LOADING_START: "engine:loading-start",
  LOADING_END: "engine:loading-end",
} as const;

export type EngineEventKey = (typeof ENGINE_EVENTS)[keyof typeof ENGINE_EVENTS];
