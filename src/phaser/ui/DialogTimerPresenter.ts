import type Phaser from "phaser";
import type { DialogLayout } from "./CardDialogLayout";
import type { TurnTimerController } from "../controllers/TurnTimerController";
import { attachDialogTimerBar } from "./DialogTimerBar";
import { DialogTimerHandle } from "./DialogTimerHandle";
import type { TimerBar } from "./TimerBar";

export class DialogTimerPresenter {
  private timerBar?: TimerBar;
  private timerHandle: DialogTimerHandle;

  constructor(private scene: Phaser.Scene, timerController?: TurnTimerController) {
    this.timerHandle = new DialogTimerHandle(timerController);
  }

  attach(dialog: Phaser.GameObjects.Container, layout: DialogLayout, onExpire?: () => void) {
    this.destroyBar();
    this.timerBar = attachDialogTimerBar(this.scene, dialog, layout);
    this.timerHandle.start(this.timerBar, onExpire);
    return this.timerBar;
  }

  stop() {
    this.timerHandle.stop();
    this.destroyBar();
  }

  private destroyBar() {
    this.timerBar?.destroy();
    this.timerBar = undefined;
  }
}
