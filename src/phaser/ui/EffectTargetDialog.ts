import type Phaser from "phaser";
import type { SlotViewModel } from "./SlotTypes";
import { PilotTargetDialog, type PilotTargetDialogShowOpts } from "./PilotTargetDialog";
import type { TurnTimerController } from "../controllers/TurnTimerController";

type EffectTargetDialogShowOpts = {
  targets: SlotViewModel[];
  header?: string;
  onSelect: (slot: SlotViewModel) => Promise<void> | void;
  showCloseButton?: boolean;
  onClose?: () => void;
};

// Reuses PilotTargetDialog layout but keeps piloted slots visible for effect targeting.
export class EffectTargetDialog extends PilotTargetDialog {
  constructor(
    scene: Phaser.Scene,
    createSlotSprite?: (slot: SlotViewModel, size: { w: number; h: number }) => Phaser.GameObjects.Container | undefined,
    timerController?: TurnTimerController,
  ) {
    super(scene, createSlotSprite, timerController);
  }

  show(opts: EffectTargetDialogShowOpts) {
    const baseOpts: PilotTargetDialogShowOpts = {
      targets: opts.targets,
      onSelect: opts.onSelect,
      header: opts.header ?? "Choose a Target",
      allowPiloted: true,
      closeOnBackdrop: false,
      showCloseButton: opts.showCloseButton ?? false,
      onClose: opts.onClose,
    };
    super.show(baseOpts);
  }
}
