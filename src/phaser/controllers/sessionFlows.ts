import type { GameStatusResponse } from "../game/GameTypes";
import type { GameEngine } from "../game/GameEngine";
import type { MatchStateMachine } from "../game/MatchStateMachine";
import type { GameContextStore } from "../game/GameContextStore";
import { submitDeckFromStorage } from "../game/deckSubmissionFlow";
import type { DebugControls } from "./DebugControls";
import { updateSession } from "../game/SessionStore";
import type { ScenarioPlayerSelector } from "../game/SeatSelector";

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
    playerName?: string | null;
    isAutoPolling?: boolean;
    playerSelector?: ScenarioPlayerSelector;
    hasPlayerOverride?: boolean;
  },
) {
  const { match, engine, contextStore, debugControls } = deps;
  const joinName = params.playerName || "Demo Opponent";
  let joinedViaRoom = true;
  let joinResp: any = null;

  try {
    joinResp = await match.joinRoom(params.gameId);
  } catch (err) {
    if (!params.hasPlayerOverride) {
      throw err;
    }
    const selector = params.playerSelector || "currentPlayer";
    const seatResp = await match.resolveSeatSession(params.gameId, selector);
    if (!seatResp?.success || !seatResp?.resolvedPlayerId || !seatResp?.sessionToken) {
      throw err;
    }
    joinedViaRoom = false;
    joinResp = {
      success: true,
      gameId: params.gameId,
      playerId: seatResp.resolvedPlayerId,
      sessionToken: seatResp.sessionToken,
      sessionExpiresAt: seatResp.sessionExpiresAt,
    };
    updateSession({
      gameId: params.gameId,
      playerId: seatResp.resolvedPlayerId,
      sessionToken: seatResp.sessionToken,
      sessionExpiresAt: seatResp.sessionExpiresAt ?? null,
    });
    match.adoptJoinSession(params.gameId);
  }

  const resolvedPlayerId = joinResp?.playerId || contextStore.get().playerId || "";
  if (!resolvedPlayerId) {
    throw new Error("Join failed: missing player id");
  }
  if (joinedViaRoom) {
    await submitDeckFromStorage({
      gameId: params.gameId,
      playerId: resolvedPlayerId,
      source: "join",
      emptyDeckMessage: "Deck is empty. Please setup your deck before joining.",
      submit: (payload) => match.submitDeck(params.gameId, resolvedPlayerId, payload),
    });
  }
  contextStore.update({ playerId: resolvedPlayerId, playerName: joinName });
  const statusPayload = (await match.getGameStatus(params.gameId, resolvedPlayerId)) as GameStatusResponse;
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
  const hostGameId = state.gameId || hostResp?.gameId || hostResp?.roomId;
  const hostPlayerId = hostResp?.playerId || contextStore.get().playerId || "";
  if (!hostGameId || !hostPlayerId) {
    throw new Error("Host flow missing game/player id.");
  }
  await submitDeckFromStorage({
    gameId: hostGameId,
    playerId: hostPlayerId,
    source: "host",
    emptyDeckMessage: "Deck is empty. Please setup your deck before creating a room.",
    submit: (payload) => match.submitDeck(hostGameId, hostPlayerId, payload),
  });
  if (params.isAutoPolling) {
    await debugControls?.startAutoPolling();
  }
}
