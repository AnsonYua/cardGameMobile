import type { TimerRenderer, TurnTimerController } from "../controllers/TurnTimerController";

export class DialogTimerHandle {
  private token?: number;

  constructor(private controller?: TurnTimerController) {}

  start(renderer: TimerRenderer, onExpire?: () => void) {
    if (!this.controller) return;
    this.token = this.controller.startDialogTimer(renderer, onExpire);
  }

  stop() {
    if (this.token !== undefined) {
      this.controller?.endDialogTimer(this.token);
      this.token = undefined;
    }
    this.controller?.resumeTurnTimer();
  }
}
