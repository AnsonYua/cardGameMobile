import { GameStatus } from "./GameSessionService";

export enum GamePhase {
  Redraw = "REDRAW_PHASE",
}

export type GameStatusResponse = {
  status?: GameStatus | string;
  gameStatus?: GameStatus | string;
  aiAutoplay?: {
    isAiMatch?: boolean;
    aiPlayerIds?: string[];
    hasMoreAiWork?: boolean;
    throttleWaitMs?: number;
  };
  aiStepExecuted?: boolean;
  hasMoreAiWork?: boolean;
  retryAfterMs?: number;
  gameEnv?: {
    phase?: GamePhase | string;
    [key: string]: any;
  };
  phase?: GamePhase | string;
  resourceBundleToken?: string;

  [key: string]: any;
};
