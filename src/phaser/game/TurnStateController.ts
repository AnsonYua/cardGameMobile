export class TurnStateController {
  private lastSelfTurn = true;

  update(raw: any, localPlayerId: string) {
    const currentPlayer = raw?.gameEnv?.currentPlayer;
    const isSelfTurn = !!currentPlayer && currentPlayer === localPlayerId;
    this.lastSelfTurn = isSelfTurn;
    return isSelfTurn;
  }

  isSelfTurn() {
    return this.lastSelfTurn;
  }
}
