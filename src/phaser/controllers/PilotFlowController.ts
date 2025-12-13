import Phaser from "phaser";
import type { ActionSource } from "../game/GameEngine";
import type { GameContext } from "../game/GameContextStore";
import type { SlotPresenter } from "../ui/SlotPresenter";
import type { SlotViewModel } from "../ui/SlotTypes";
import { PilotTargetDialog } from "../ui/PilotTargetDialog";
import { PilotDesignationDialog } from "../ui/PilotDesignationDialog";
import type { GameEngine } from "../game/GameEngine";

type PilotFlowDeps = {
  scene: Phaser.Scene;
  engine: GameEngine;
  slotPresenter: SlotPresenter;
  gameContext: GameContext;
  pilotTargetDialog: PilotTargetDialog;
  pilotDesignationDialog: PilotDesignationDialog;
  runActionThenRefresh: (actionId: string, actionSource?: ActionSource) => Promise<void | boolean>;
};

export class PilotFlowController {
  private deps: PilotFlowDeps;

  constructor(deps: PilotFlowDeps) {
    this.deps = deps;
  }

  showPilotDesignationDialog() {
    const { pilotDesignationDialog, runActionThenRefresh } = this.deps;
    pilotDesignationDialog.show({
      onPilot: async () => {
        this.showPilotTargetDialog("playPilotDesignationAsPilot");
      },
      onCommand: async () => {
        await runActionThenRefresh("playPilotDesignationAsCommand", "neutral");
      },
    });
  }

  showPilotTargetDialog(actionId: string) {
    const { engine, pilotTargetDialog } = this.deps;
    engine.setPilotTarget(undefined);
    const targets = this.collectPilotTargetUnits();
    pilotTargetDialog.show({
      targets,
      onSelect: async (slot) => {
        const targetUid = slot?.unit?.cardUid || slot?.unit?.id;
        if (!targetUid) {
          console.warn("No target unit uid found for pilot target selection");
          return;
        }
        engine.setPilotTarget(targetUid);
        await this.deps.runActionThenRefresh(actionId, "neutral");
      },
    });
  }

  private collectPilotTargetUnits(): SlotViewModel[] {
    const { engine, slotPresenter, gameContext } = this.deps;
    const snapshot = engine.getSnapshot();
    const raw: any = snapshot.raw;
    if (!raw) return [];
    const playerId = gameContext.playerId;
    const slots = slotPresenter.toSlots(raw, playerId);
    // Only show self slots with a unit and no pilot; first 6 max (3x2 grid).
    return slots.filter((s) => s.owner === "player" && s.unit && !s.pilot).slice(0, 6);
  }
}
