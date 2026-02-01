import { getCurrentTurn, hasActiveBurstPrompt, setClientTurnOwnerId } from "./turnOwner";

export class TurnStateController {
  private lastSelfTurn = true;
  private turnOwnerId?: string;
  private lastTurn?: number;

  update(raw: any, localPlayerId: string) {
    const currentPlayer = raw?.gameEnv?.currentPlayer ?? raw?.currentPlayer;
    const currentTurn = getCurrentTurn(raw);
    const promptActive = hasActiveBurstPrompt(raw);

    const explicitTurnOwnerId = raw?.gameEnv?.turnOwnerId;
    if (typeof explicitTurnOwnerId === "string" && explicitTurnOwnerId) {
      this.turnOwnerId = explicitTurnOwnerId;
    } else {
      if (typeof currentTurn === "number") {
        if (typeof this.lastTurn === "number" && currentTurn > this.lastTurn) {
          if (typeof currentPlayer === "string" && currentPlayer) {
            this.turnOwnerId = currentPlayer;
          }
          this.lastTurn = currentTurn;
        } else if (this.lastTurn === undefined) {
          // Avoid caching a repurposed `currentPlayer` during burst prompts; wait until prompts clear.
          if (!promptActive && typeof currentPlayer === "string" && currentPlayer) {
            this.turnOwnerId = currentPlayer;
          }
          this.lastTurn = currentTurn;
        }
      } else if (!this.turnOwnerId && !promptActive && typeof currentPlayer === "string" && currentPlayer) {
        // Fallback for payloads missing `currentTurn` (e.g., early game/start) when no prompt is active.
        this.turnOwnerId = currentPlayer;
      }
    }

    if (this.turnOwnerId) {
      setClientTurnOwnerId(raw, this.turnOwnerId);
    }

    const isSelfTurn = this.turnOwnerId
      ? this.turnOwnerId === localPlayerId
      : !promptActive && typeof currentPlayer === "string" && currentPlayer === localPlayerId;

    this.lastSelfTurn = isSelfTurn;
    return isSelfTurn;
  }

  isSelfTurn() {
    return this.lastSelfTurn;
  }

  getTurnOwnerId() {
    return this.turnOwnerId;
  }
}
