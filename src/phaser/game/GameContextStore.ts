import { GameMode } from "./GameSessionService";
import type { ScenarioPlayerSelector } from "./SeatSelector";

export type GameContext = {
  playerId: string;
  playerName: string;
  gameId: string | null;
  joinToken?: string | null;
  playerSelector: ScenarioPlayerSelector;
  mode: GameMode;
  lastStatus: any;
};

export class GameContextStore {
  private context: GameContext = {
    playerId: "playerId_1",
    playerName: "Demo Player",
    gameId: null,
    joinToken: null,
    playerSelector: "currentPlayer",
    mode: GameMode.Host,
    lastStatus: null,
  };

  get(): GameContext {
    return this.context;
  }

  update(partial: Partial<GameContext>) {
    Object.assign(this.context, partial);
  }
}
