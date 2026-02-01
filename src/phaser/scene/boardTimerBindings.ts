import type Phaser from "phaser";
import { TurnTimerController } from "../controllers/TurnTimerController";
import { getTurnOwnerId } from "../game/turnOwner";

type HeaderTimerControls = {
  setTimerProgress?: (progress: number, secondsLeft: number) => void;
  setTimerVisible?: (visible: boolean) => void;
};

type TurnTimerUpdateOpts = {
  playerId: string;
  isShuffleAnimating: boolean;
  onExpire: () => void;
};

export function createTurnTimerBindings(scene: Phaser.Scene, headerControls?: HeaderTimerControls) {
  const timer = new TurnTimerController(scene);
  if (headerControls?.setTimerProgress && headerControls?.setTimerVisible) {
    timer.setHeaderRenderer({
      setProgress: (progress, secondsLeft) => headerControls.setTimerProgress?.(progress, secondsLeft),
      setVisible: (visible) => headerControls.setTimerVisible?.(visible),
    });
  }

  const update = (raw: any, opts: TurnTimerUpdateOpts) => {
    if (timer.isDialogActive()) return;
    if (opts.isShuffleAnimating) {
      timer.setEnabled(false);
      return;
    }
    const isSelfTurn = getTurnOwnerId(raw) === opts.playerId;
    if (!isSelfTurn) {
      timer.setEnabled(false);
      return;
    }
    timer.setEnabled(true);
    if (timer.isDialogActive()) return;
    timer.ensureTurnTimer(opts.onExpire);
  };

  return { timer, update };
}
