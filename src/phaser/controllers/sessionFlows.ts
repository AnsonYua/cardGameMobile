import type { GameStatusResponse } from "../game/GameTypes";
import type { GameEngine } from "../game/GameEngine";
import type { MatchStateMachine } from "../game/MatchStateMachine";
import type { GameContextStore } from "../game/GameContextStore";
import type { DebugControls } from "./DebugControls";

type FlowDeps = {
  match: MatchStateMachine;
  engine: GameEngine;
  contextStore: GameContextStore;
  debugControls?: DebugControls;
};

export async function runJoinFlow(
  deps: FlowDeps,
  params: {
    gameId: string;
    joinToken: string;
    playerName?: string | null;
    isAutoPolling?: boolean;
  },
) {
  const { match, engine, contextStore, debugControls } = deps;
  const joinName = params.playerName || "Demo Opponent";
  const joinResp = await match.joinRoom(params.gameId, params.joinToken);
  const resolvedPlayerId = joinResp?.playerId || contextStore.get().playerId || "";
  if (!resolvedPlayerId) {
    throw new Error("Join failed: missing player id");
  }
  contextStore.update({ playerId: resolvedPlayerId, playerName: joinName });
  const statusPayload = (await match.getGameStatus(params.gameId, resolvedPlayerId)) as GameStatusResponse;
  await engine.loadGameResources(params.gameId, resolvedPlayerId, statusPayload);
  await engine.updateGameStatus(params.gameId, resolvedPlayerId, {
    statusPayload,
  });
  if (params.isAutoPolling) {
    await debugControls?.startAutoPolling();
  }
}

export async function runHostFlow(
  deps: FlowDeps,
  params: {
    playerName?: string | null;
    aiMode?: boolean;
    isAutoPolling?: boolean;
  },
) {
  const { match, contextStore, debugControls } = deps;
  const context = contextStore.get();
  const hostName = params.playerName || context.playerName || "Demo Player";
  contextStore.update({ playerName: hostName });
  const hostResp = await match.startAsHost({ playerName: hostName }, { aiMode: params.aiMode });
  const state = match.getState();
  if (state.gameId) {
    contextStore.update({ gameId: state.gameId });
  }
  if (hostResp?.playerId) {
    contextStore.update({ playerId: hostResp.playerId });
  }
  if (hostResp?.joinToken) {
    contextStore.update({ joinToken: hostResp.joinToken });
  }
  if (params.isAutoPolling) {
    await debugControls?.startAutoPolling();
  }
}
