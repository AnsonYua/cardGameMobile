import { GameMode } from "./GameSessionService";

export type GameContext = {
  playerId: string;
  playerName: string;
  gameId: string | null;
  mode: GameMode;
  lastStatus: any;
};

export class GameContextStore {
  private context: GameContext = {
    playerId: "playerId_1",
    playerName: "Demo Player",
    gameId: null,
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
