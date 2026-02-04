import Phaser from "phaser";
import type { ActionSource } from "../game/GameEngine";
import type { GameContext } from "../game/GameContextStore";
import type { SlotPresenter } from "../ui/SlotPresenter";
import type { SlotViewModel } from "../ui/SlotTypes";
import { PilotTargetDialog } from "../ui/PilotTargetDialog";
import { PilotDesignationDialog } from "../ui/PilotDesignationDialog";
import type { GameEngine } from "../game/GameEngine";
import { isBattleActionStep } from "../game/battleUtils";
import { commandHasTimingWindow } from "../game/actionEligibility";

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

  showPilotDesignationDialog(selection?: { uid?: string; kind?: string; cardType?: string } | null) {
    const { pilotDesignationDialog, runActionThenRefresh } = this.deps;
    const raw = this.deps.engine.getSnapshot().raw as any;
    if (isBattleActionStep(raw)) {
      // Pilot play isn't allowed during action-step; force command play.
      void runActionThenRefresh("playPilotDesignationAsCommand", "neutral");
      return;
    }
    const phase = (raw?.gameEnv?.phase ?? "").toString().toUpperCase();
    const targets = this.collectPilotTargetUnits();
    const playerId = this.deps.gameContext.playerId;
    const canPlayAsCommand =
      !!selection &&
      selection.kind === "hand" &&
      (selection.cardType || "").toString().toLowerCase() === "command" &&
      !!playerId &&
      commandHasTimingWindow(selection as any, raw, playerId, phase);

    pilotDesignationDialog.show({
      allowPilot: targets.length > 0,
      allowCommand: canPlayAsCommand,
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
