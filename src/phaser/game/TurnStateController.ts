export class TurnStateController {
  private lastLocalTurn = true;

  update(raw: any, localPlayerId: string) {
    const currentPlayer = raw?.gameEnv?.currentPlayer;
    const isLocalTurn = !!currentPlayer && currentPlayer === localPlayerId;
    this.lastLocalTurn = isLocalTurn;
    return isLocalTurn;
  }

  isLocalTurn() {
    return this.lastLocalTurn;
  }
}
