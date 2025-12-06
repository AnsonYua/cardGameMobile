import Phaser from "phaser";
import { MatchStateMachine } from "./MatchStateMachine";

export type GameStatusSnapshot = {
  lastStatus: any;
  previewStatus: any;
};

export class GameEngine {
  public events = new Phaser.Events.EventEmitter();
  private snapshot: GameStatusSnapshot = { lastStatus: null, previewStatus: null };

  constructor(private match: MatchStateMachine) {}

  async updateGameStatus(gameId?: string, playerId?: string) {
    if (!gameId || !playerId) return this.snapshot;
    const status = await this.match.getGameStatus(gameId, playerId);
    this.snapshot = { lastStatus: status, previewStatus: status };
    this.events.emit("status-preview", this.snapshot);
    return this.snapshot;
  }

  getSnapshot(): GameStatusSnapshot {
    return this.snapshot;
  }
}
