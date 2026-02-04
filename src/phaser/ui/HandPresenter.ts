import { HandCardView, toBaseKey } from "./HandTypes";
import { isBattleActionStep } from "../game/battleUtils";
import { getPilotDesignationStats, hasPilotDesignationRule } from "../utils/pilotDesignation";

export class HandPresenter {
  toHandCards(raw: any, playerId: string): HandCardView[] {
    const hand = raw?.gameEnv?.players?.[playerId]?.deck?.hand || [];
    if (!Array.isArray(hand) || hand.length === 0) return [];
    const inActionStep = isBattleActionStep(raw);
    return hand.map((card: any) => {
      const uid = card?.carduid ?? card?.uid ?? card?.id ?? card?.cardId;
      const cardId = card?.cardId ?? card?.id;
      const data = card?.cardData;
      const textureKey = toBaseKey(cardId);
      const cardType = data?.cardType;
      const isPilotCommand = !inActionStep && cardType === "command" && hasPilotDesignationRule(data);
      const pilotStats = isPilotCommand ? getPilotDesignationStats(data) : null;
      const ap = isPilotCommand ? pilotStats?.ap ?? 0 : data?.ap;
      const hp = isPilotCommand ? pilotStats?.hp ?? 0 : data?.hp;
      return {
        uid,
        cardId,
        color: 0x2a2d38,
        textureKey,
        cost: data?.cost,
        ap,
        hp,
        cardType,
        fromPilotDesignation: isPilotCommand,
      };
    });
  }
}
