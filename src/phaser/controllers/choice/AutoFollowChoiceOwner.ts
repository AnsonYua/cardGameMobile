import type { ScenarioPlayerSelector } from "../../game/SeatSelector";
import { resolveAutoFollowChoiceOwner } from "./ChoiceOwnerResolver";

type LoggerLike = {
  warn: (message: string, payload?: unknown) => void;
};

export async function autoFollowChoiceOwner(params: {
  enabled: boolean;
  inFlight: boolean;
  raw: any;
  gameId: string | undefined;
  selfPlayerId: string | undefined;
  attemptedChoiceIds: Set<string>;
  resolveSeatSession: (gameId: string, selector: ScenarioPlayerSelector) => Promise<any>;
  updateSession: (partial: {
    gameId: string;
    playerId: string;
    sessionToken: string;
    sessionExpiresAt: number | null;
  }) => void;
  updateContext: (partial: { playerId: string; playerSelector: ScenarioPlayerSelector }) => void;
  refreshGameStatus: (gameId: string, playerId: string) => Promise<void>;
  refreshActions?: () => void;
  log: LoggerLike;
}): Promise<{ switched: boolean; inFlight: boolean }> {
  if (!params.enabled || params.inFlight) {
    return { switched: false, inFlight: params.inFlight };
  }

  const { gameId, selfPlayerId } = params;
  if (!gameId || !selfPlayerId) {
    return { switched: false, inFlight: false };
  }

  const decision = resolveAutoFollowChoiceOwner({
    raw: params.raw,
    selfPlayerId,
    attemptedChoiceIds: params.attemptedChoiceIds,
  });
  if (!decision) {
    return { switched: false, inFlight: false };
  }

  params.attemptedChoiceIds.add(decision.eventId);
  if (params.attemptedChoiceIds.size > 80) {
    const oldest = params.attemptedChoiceIds.values().next().value;
    if (oldest) params.attemptedChoiceIds.delete(oldest);
  }

  params.log.warn("auto follow choice owner: start seat switch", {
    gameId,
    fromPlayerId: selfPlayerId,
    toOwnerPlayerId: decision.ownerPlayerId,
    choiceType: decision.type,
    choiceEventId: decision.eventId,
    selector: decision.selector,
  });

  try {
    const seatResp = await params.resolveSeatSession(gameId, decision.selector);
    if (!seatResp?.success || !seatResp?.resolvedPlayerId || !seatResp?.sessionToken) {
      params.log.warn("auto follow choice owner: resolveSeatSession failed", {
        gameId,
        selector: decision.selector,
        response: seatResp,
      });
      return { switched: false, inFlight: false };
    }

    params.updateSession({
      gameId,
      playerId: seatResp.resolvedPlayerId,
      sessionToken: seatResp.sessionToken,
      sessionExpiresAt: seatResp.sessionExpiresAt ?? null,
    });
    params.updateContext({
      playerId: seatResp.resolvedPlayerId,
      playerSelector: decision.selector,
    });
    await params.refreshGameStatus(gameId, seatResp.resolvedPlayerId);
    params.log.warn("auto follow choice owner: seat switched", {
      gameId,
      fromPlayerId: selfPlayerId,
      toPlayerId: seatResp.resolvedPlayerId,
      choiceEventId: decision.eventId,
    });
    params.refreshActions?.();
    return { switched: true, inFlight: false };
  } catch (error) {
    params.log.warn("auto follow choice owner: seat switch exception", {
      gameId,
      choiceEventId: decision.eventId,
      error,
    });
    return { switched: false, inFlight: false };
  }
}
