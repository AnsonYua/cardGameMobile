import type Phaser from "phaser";
import type { GameStatusSnapshot } from "../game/GameEngine";
import { ENGINE_EVENTS } from "../game/EngineEvents";
import type { PilotDesignationDialogPayload } from "../game/EngineEvents";

type EventBindingDeps = {
  engine: {
    events: Phaser.Events.EventEmitter;
  };
  match: {
    events: Phaser.Events.EventEmitter;
  };
  dialogCoordinator: { updateFromSnapshot: (snapshot?: GameStatusSnapshot) => void };
  headerControls?: { setStatusFromEngine?: (status: any, opts?: { offlineFallback?: boolean }) => void } | null;
  offlineFallback: boolean;
  pilotFlow?: { showPilotDesignationDialog: () => void; showPilotTargetDialog: (actionId: string) => void } | null;
  selectionAction?: { refreshActions: (source: "neutral") => void } | null;
  onMainPhaseUpdate: (silent: boolean, snapshot: GameStatusSnapshot) => void;
  onShowLoading: () => void;
  onHideLoading: () => void;
};

export function bindBoardSceneEvents(deps: EventBindingDeps) {
  deps.engine.events.on(ENGINE_EVENTS.BATTLE_STATE_CHANGED, (payload: { active: boolean; status: string }) => {
    const status = (payload.status || "").toUpperCase();
    if (payload.active && status === "ACTION_STEP") {
      deps.headerControls?.setStatusFromEngine?.("Action Step", { offlineFallback: deps.offlineFallback });
    }
  });
  deps.engine.events.on(ENGINE_EVENTS.MAIN_PHASE_UPDATE, (snapshot: GameStatusSnapshot) => {
    deps.onMainPhaseUpdate(false, snapshot);
  });
  deps.engine.events.on(ENGINE_EVENTS.MAIN_PHASE_UPDATE_SILENT, (snapshot: GameStatusSnapshot) => {
    deps.onMainPhaseUpdate(true, snapshot);
  });
  deps.engine.events.on(ENGINE_EVENTS.MAIN_PHASE_ENTER, () => {
    deps.selectionAction?.refreshActions("neutral");
  });
  deps.engine.events.on(ENGINE_EVENTS.PILOT_DESIGNATION_DIALOG, (payload?: PilotDesignationDialogPayload) => {
    deps.pilotFlow?.showPilotDesignationDialog(payload?.selection);
  });
  deps.engine.events.on(ENGINE_EVENTS.PILOT_TARGET_DIALOG, () => {
    deps.pilotFlow?.showPilotTargetDialog("playPilotFromHand");
  });
  deps.engine.events.on(ENGINE_EVENTS.GAME_RESOURCE, (payload: any) => {
    void payload;
  });
  deps.engine.events.on(ENGINE_EVENTS.LOADING_START, () => deps.onShowLoading());
  deps.engine.events.on(ENGINE_EVENTS.LOADING_END, () => deps.onHideLoading());
  deps.engine.events.on(ENGINE_EVENTS.STATUS, (snapshot: GameStatusSnapshot) => {
    deps.dialogCoordinator.updateFromSnapshot(snapshot);
  });
  deps.match.events.on("status", () => {
    deps.dialogCoordinator.updateFromSnapshot();
  });
}
