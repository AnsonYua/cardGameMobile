import { createLogger } from "../utils/logger";

type AnimationQueueLike = {
  isProcessed?: (id: string) => boolean;
};

type TurnStartDrawGateDeps = {
  getPlayerId: () => string | undefined;
  getAnimationQueue: () => AnimationQueueLike | undefined;
  getNotifications: (raw: any) => any[];
};

export class TurnStartDrawGate {
  private readonly log = createLogger("TurnStartDrawGate");
  private lastCurrentPlayerId?: string;
  private turnStartDrawPopupActive = false;
  private awaitingTurnStartDraw = false;

  constructor(private deps: TurnStartDrawGateDeps) {}

  onTurnStartDrawPopupStart() {
    this.turnStartDrawPopupActive = true;
    this.awaitingTurnStartDraw = true;
    this.log.debug("popup start");
  }

  onTurnStartDrawPopupEnd() {
    this.turnStartDrawPopupActive = false;
    this.awaitingTurnStartDraw = false;
    this.log.debug("popup end");
  }

  updateFromSnapshot(raw: any) {
    const currentPlayer = raw?.gameEnv?.currentPlayer ?? raw?.currentPlayer;
    const selfId = this.deps.getPlayerId();
    if (!currentPlayer || !selfId) {
      this.log.debug("updateFromSnapshot missing player", {
        currentPlayer,
        selfId,
        awaitingTurnStartDraw: this.awaitingTurnStartDraw,
        turnStartDrawPopupActive: this.turnStartDrawPopupActive,
      });
      this.lastCurrentPlayerId = currentPlayer;
      return;
    }
    if (currentPlayer !== this.lastCurrentPlayerId) {
      this.log.debug("updateFromSnapshot currentPlayer changed", {
        currentPlayer,
        lastCurrentPlayerId: this.lastCurrentPlayerId,
        selfId,
      });
    }
    if (currentPlayer === selfId) {
      const pendingTurnStartDraw = this.shouldDelayTurnTimerForTurnStartDraw(raw);
      if (this.awaitingTurnStartDraw !== pendingTurnStartDraw) {
        this.log.debug("updateFromSnapshot set awaitingTurnStartDraw", {
          pendingTurnStartDraw,
        });
      }
      this.awaitingTurnStartDraw = pendingTurnStartDraw;
      if (!pendingTurnStartDraw) {
        this.turnStartDrawPopupActive = false;
      }
    } else {
      if (this.awaitingTurnStartDraw || this.turnStartDrawPopupActive) {
        this.log.debug("updateFromSnapshot clear awaitingTurnStartDraw");
      }
      this.awaitingTurnStartDraw = false;
      this.turnStartDrawPopupActive = false;
    }
    this.lastCurrentPlayerId = currentPlayer;
  }

  getTurnTimerBlockReason(raw: any) {
    if (this.turnStartDrawPopupActive) return "turnStartDrawPopupActive";
    if (this.awaitingTurnStartDraw) return "awaitingTurnStartDraw";
    if (this.shouldDelayTurnTimerForTurnStartDraw(raw)) return "pendingTurnStartDraw";
    return null;
  }

  shouldDelayActionBar(raw: any) {
    const phase = (raw?.gameEnv?.phase ?? "").toString().toUpperCase();
    if (phase !== "MAIN_PHASE") return false;
    const currentPlayer = raw?.gameEnv?.currentPlayer;
    const playerId = this.deps.getPlayerId();
    if (!currentPlayer || currentPlayer !== playerId) return false;
    const delayForPopup = this.turnStartDrawPopupActive;
    const delayForAwait = this.awaitingTurnStartDraw;
    const delayForAnim = this.shouldDelayTurnTimerForTurnStartDraw(raw);
    const delayActionBar = delayForPopup || delayForAwait || delayForAnim;
    return delayActionBar;
  }

  private shouldDelayTurnTimerForTurnStartDraw(raw: any) {
    const playerId = this.deps.getPlayerId();
    if (!playerId) return false;
    const notifications = this.deps.getNotifications(raw);
    if (!notifications.length) return false;
    const contextPlayer = raw?.gameEnv?.currentPlayer ?? raw?.currentPlayer;
    const matchedNote = notifications.find((note) => {
      if (!note?.id) return false;
      const type = (note.type || "").toUpperCase();
      if (type !== "CARD_DRAWN") return false;
      if (note.payload?.playerId !== playerId) return false;
      if (contextPlayer && note.payload?.playerId !== contextPlayer) return false;
      const drawContext = (note.payload?.drawContext ?? "").toString().toLowerCase();
      if (drawContext !== "turn_start") return false;
      return true;
    });
    if (!matchedNote) return false;
    const processed = this.deps.getAnimationQueue()?.isProcessed?.(matchedNote.id);
    this.log.debug("shouldDelayTurnTimerForTurnStartDraw", {
      noteId: matchedNote.id,
      processed,
      playerId,
      contextPlayer,
      drawContext: matchedNote.payload?.drawContext,
    });
    return !processed;
  }
}
