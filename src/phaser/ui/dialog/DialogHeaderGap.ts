import { getDialogTimerHeaderGap } from "../timerBarStyles";

export function resolveDialogHeaderGap(showTimer: boolean, defaultGap: number): number {
  return showTimer ? getDialogTimerHeaderGap() : defaultGap;
}
