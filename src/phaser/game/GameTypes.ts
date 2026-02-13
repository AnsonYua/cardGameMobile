import { GameStatus } from "./GameSessionService";

export enum GamePhase {
  Redraw = "REDRAW_PHASE",
}

export type GameStatusResponse = {
  status?: GameStatus | string;
  gameStatus?: GameStatus | string;
  gameEnv?: {
    phase?: GamePhase | string;
    [key: string]: any;
  };
  phase?: GamePhase | string;
  resourceBundleToken?: string;

  [key: string]: any;
};
