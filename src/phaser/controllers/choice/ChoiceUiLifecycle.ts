import type { ActionControls } from "../ControllerTypes";

type HideableDialog = {
  hide?: () => void;
};

const DEFAULT_WAITING_LABEL = "Waiting for opponent...";

export function isChoiceOwner(ownerPlayerId: string | undefined, selfPlayerId: string | undefined) {
  return !!ownerPlayerId && !!selfPlayerId && ownerPlayerId === selfPlayerId;
}

export function enterWaiting(
  actionControls?: ActionControls | null,
  onTimerPause?: () => void,
  label = DEFAULT_WAITING_LABEL,
) {
  onTimerPause?.();
  actionControls?.setWaitingLabel?.(label);
  actionControls?.setWaitingForOpponent?.(true);
  actionControls?.setState?.({ descriptors: [] });
}

export function exitWaiting(actionControls?: ActionControls | null, onTimerResume?: () => void) {
  onTimerResume?.();
  actionControls?.setWaitingForOpponent?.(false);
  actionControls?.setState?.({ descriptors: [] });
}

export function cleanupDialog(
  dialog?: HideableDialog | null,
  actionControls?: ActionControls | null,
  onTimerResume?: () => void,
) {
  dialog?.hide?.();
  exitWaiting(actionControls, onTimerResume);
}

export function applyChoiceActionBarState(params: {
  ownerPlayerId?: string;
  selfPlayerId?: string;
  actionControls?: ActionControls | null;
  onTimerPause?: () => void;
  onTimerResume?: () => void;
  waitingLabel?: string;
}) {
  const isOwner = isChoiceOwner(params.ownerPlayerId, params.selfPlayerId);
  if (!isOwner) {
    enterWaiting(params.actionControls, params.onTimerPause, params.waitingLabel);
    return false;
  }
  exitWaiting(params.actionControls, params.onTimerResume);
  return true;
}
