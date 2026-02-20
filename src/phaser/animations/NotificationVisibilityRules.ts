export type CardAddedToHandView =
  | { visible: false; reason: "hidden" }
  | { visible: true; mode: "self"; title: "Card Added to Hand" }
  | { visible: true; mode: "opponent_burst"; title: "Burst - Opponent added card to hand" }
  | { visible: true; mode: "opponent_reveal"; title: "Opponent Revealed Card Added to Hand" };

export function resolveCardAddedToHandView(params: {
  eventType: string;
  payload: any;
  currentPlayerId: string | null;
}): CardAddedToHandView {
  const eventType = (params.eventType ?? "").toString().toUpperCase();
  const playerId = (params.payload?.playerId ?? "").toString();
  if (eventType !== "CARD_ADDED_TO_HAND" || !params.currentPlayerId || !playerId) {
    return { visible: false, reason: "hidden" };
  }

  const isSelf = playerId === params.currentPlayerId;
  if (isSelf) {
    return { visible: true, mode: "self", title: "Card Added to Hand" };
  }

  const reason = (params.payload?.reason ?? "").toString().toLowerCase();
  if (reason === "burst") {
    return { visible: true, mode: "opponent_burst", title: "Burst - Opponent added card to hand" };
  }

  if (params.payload?.reveal === true || params.payload?.revealToOpponent === true) {
    return { visible: true, mode: "opponent_reveal", title: "Opponent Revealed Card Added to Hand" };
  }

  return { visible: false, reason: "hidden" };
}
