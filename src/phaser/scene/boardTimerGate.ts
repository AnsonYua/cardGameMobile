import type { TurnStartDrawGate } from "../controllers/TurnStartDrawGate";
import type { TurnTimerController } from "../controllers/TurnTimerController";

type TimerGateParams = {
  raw: any;
  gate: TurnStartDrawGate | undefined;
  timer: TurnTimerController | undefined;
  updateTurnTimerFromSnapshot: ((raw: any) => void) | undefined;
  log?: { debug?: (message: string, meta?: any) => void };
};

export function updateTurnTimerWithGate({
  raw,
  gate,
  timer,
  updateTurnTimerFromSnapshot,
  log,
}: TimerGateParams) {
  gate?.updateFromSnapshot(raw);
  const blockReason = gate?.getTurnTimerBlockReason(raw);
  if (blockReason) {
    log?.debug?.("updateTurnTimer blocked", { reason: blockReason });
    timer?.setEnabled(false);
    return;
  }
  updateTurnTimerFromSnapshot?.(raw);
}

type TimerPauseResumeParams = {
  engineGetRaw: () => any;
  timer: TurnTimerController | undefined;
  setHeaderTimerVisible?: (visible: boolean) => void;
  updateTurnTimer: (raw: any) => void;
};

export function createTimerPauseResumeHandlers({
  engineGetRaw,
  timer,
  setHeaderTimerVisible,
  updateTurnTimer,
}: TimerPauseResumeParams) {
  const onTimerPause = () => {
    timer?.setEnabled(false);
    setHeaderTimerVisible?.(false);
  };
  const onTimerResume = () => {
    const raw = engineGetRaw();
    if (raw) {
      updateTurnTimer(raw);
    } else {
      timer?.setEnabled(true);
    }
  };
  return { onTimerPause, onTimerResume };
}

type TurnStartDrawHandlersParams = {
  gate: TurnStartDrawGate | undefined;
  timer: TurnTimerController | undefined;
  engineGetRaw: () => any;
  updateTurnTimer: (raw: any) => void;
  refreshActionBar: (raw: any) => void;
  hideActionBarForTurnStartDraw: (raw: any) => void;
  log?: { debug?: (message: string, meta?: any) => void };
};

export function createTurnStartDrawHandlers({
  gate,
  timer,
  engineGetRaw,
  updateTurnTimer,
  refreshActionBar,
  hideActionBarForTurnStartDraw,
  log,
}: TurnStartDrawHandlersParams) {
  const onTurnStartDrawPopupStart = () => {
    log?.debug?.("onTurnStartDrawPopupStart");
    gate?.onTurnStartDrawPopupStart();
    timer?.setEnabled(false);
    const raw = engineGetRaw();
    if (raw) {
      hideActionBarForTurnStartDraw(raw);
    }
  };
  const onTurnStartDrawPopupEnd = () => {
    log?.debug?.("onTurnStartDrawPopupEnd");
    gate?.onTurnStartDrawPopupEnd();
    const raw = engineGetRaw();
    if (raw) {
      updateTurnTimer(raw);
      refreshActionBar(raw);
    } else {
      timer?.setEnabled(true);
    }
  };
  return { onTurnStartDrawPopupStart, onTurnStartDrawPopupEnd };
}

type ActionBarGateParams = {
  raw: any;
  gate: TurnStartDrawGate | undefined;
  setWaitingForOpponent?: (value: boolean) => void;
  setState?: (state: { descriptors: any[] }) => void;
  log?: { debug?: (message: string, meta?: any) => void };
};

export function hideActionBarForTurnStartDrawWithGate({
  raw,
  gate,
  setWaitingForOpponent,
  setState,
  log,
}: ActionBarGateParams) {
  if (!(gate?.shouldDelayActionBar(raw) ?? false)) {
    log?.debug?.("hideActionBarForTurnStartDraw skipped");
    return;
  }
  log?.debug?.("hideActionBarForTurnStartDraw applied");
  setWaitingForOpponent?.(false);
  setState?.({ descriptors: [] });
}
