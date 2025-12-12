import type Phaser from "phaser";
import type { SlotViewModel } from "./SlotTypes";
import { PilotTargetDialog, type PilotTargetDialogShowOpts } from "./PilotTargetDialog";

type EffectTargetDialogShowOpts = {
  targets: SlotViewModel[];
  header?: string;
  onSelect: (slot: SlotViewModel) => Promise<void> | void;
};

// Reuses PilotTargetDialog layout but keeps piloted slots visible for effect targeting.
export class EffectTargetDialog extends PilotTargetDialog {
  constructor(scene: Phaser.Scene) {
    super(scene);
  }

  show(opts: EffectTargetDialogShowOpts) {
    const baseOpts: PilotTargetDialogShowOpts = {
      targets: opts.targets,
      onSelect: opts.onSelect,
      header: opts.header ?? "Choose a Target",
      allowPiloted: true,
    };
    super.show(baseOpts);
  }
}
