import { HandCardView, toBaseKey } from "./HandTypes";

export class HandPresenter {
  toHandCards(raw: any, playerId: string): HandCardView[] {
    const hand = raw?.gameEnv?.players?.[playerId]?.deck?.hand || [];
    if (!Array.isArray(hand) || hand.length === 0) return [];
    return hand.map((card: any) => {
      const uid = card?.carduid ?? card?.uid ?? card?.id ?? card?.cardId;
      const cardId = card?.cardId ?? card?.id;
      const data = card?.cardData;
      const rules: any[] = Array.isArray(data?.effects?.rules) ? data.effects.rules : [];
      const pilotRule = rules.find((r) => r?.effectId === "pilot_designation");
      const pilotParams = pilotRule?.parameters || {};
      const pilotAp = pilotParams.AP ?? pilotParams.ap ?? null;
      const pilotHp = pilotParams.HP ?? pilotParams.hp ?? null;
      const textureKey = toBaseKey(cardId);
      const cardType = data?.cardType;
      const isPilotCommand = cardType === "command" && pilotRule;
      const ap = isPilotCommand ? pilotAp ?? 0 : data?.ap;
      const hp = isPilotCommand ? pilotHp ?? 0 : data?.hp;
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
