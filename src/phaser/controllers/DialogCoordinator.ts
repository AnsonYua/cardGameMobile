import type { GameStatusSnapshot } from "../game/GameEngine";
import type { MatchStateMachine } from "../game/MatchStateMachine";
import type { GameContextStore } from "../game/GameContextStore";
import { GameMode, GameStatus } from "../game/GameSessionService";

type StatusDialog = { showMessage: (promptText: string, headerText?: string) => void; hide: () => void };

export class DialogCoordinator {
  private waitingOpponentDialog?: StatusDialog;
  private mulliganWaitingDialog?: StatusDialog;
  private mulliganDecisionSubmitted = false;
  private opponentJoined = false;

  constructor(private match: MatchStateMachine, private contextStore: GameContextStore) {}

  setWaitingOpponentDialog(dialog?: StatusDialog) {
    this.waitingOpponentDialog = dialog;
  }

  setMulliganWaitingDialog(dialog?: StatusDialog) {
    this.mulliganWaitingDialog = dialog;
  }

  resetSession() {
    this.mulliganDecisionSubmitted = false;
    this.opponentJoined = false;
    this.waitingOpponentDialog?.hide();
    this.mulliganWaitingDialog?.hide();
  }

  markMulliganDecisionSubmitted() {
    this.mulliganDecisionSubmitted = true;
  }

  updateFromSnapshot(snapshot?: GameStatusSnapshot) {
    this.updateWaitingOpponentDialog(snapshot);
    this.updateMulliganWaitingDialog(snapshot);
  }

  private updateWaitingOpponentDialog(snapshot?: GameStatusSnapshot) {
    const mode = this.contextStore.get().mode;
    if (mode !== GameMode.Host) {
      this.waitingOpponentDialog?.hide();
      return;
    }
    const matchState = this.match.getState();
    const raw = snapshot?.raw as any;
    const env = raw?.gameEnv ?? raw ?? {};
    const players = env?.players ?? null;
    const hasOpponent = players ? Object.keys(players).length > 1 : false;
    const gameStarted = !!env?.gameStarted;
    const phase = env?.phase;
    if (hasOpponent || gameStarted || phase === "DECIDE_FIRST_PLAYER_PHASE") {
      this.opponentJoined = true;
    }
    if (this.opponentJoined) {
      this.waitingOpponentDialog?.hide();
      return;
    }

    if (!hasOpponent && matchState.status === GameStatus.WaitingOpponent) {
      this.waitingOpponentDialog?.showMessage("Waiting for opponent...", "Waiting for Opponent");
    } else {
      this.waitingOpponentDialog?.hide();
    }
  }

  private updateMulliganWaitingDialog(snapshot?: GameStatusSnapshot) {
    if (!this.mulliganDecisionSubmitted) {
      this.mulliganWaitingDialog?.hide();
      return;
    }
    const raw = snapshot?.raw as any;
    const phase = raw?.gameEnv?.phase ?? raw?.phase;
    if (phase === "REDRAW_PHASE") {
      this.mulliganWaitingDialog?.showMessage("Waiting for Opponent Mulligan Decision...", "Mulligan");
      return;
    }
    this.mulliganDecisionSubmitted = false;
    this.mulliganWaitingDialog?.hide();
  }
}
