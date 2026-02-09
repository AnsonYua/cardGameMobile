import { isCardLinkedInPlay } from "./slotUtils";

function ruleRequiresDuringLink(effectRule: any, cardData?: any): boolean {
  const desc: string[] = Array.isArray(cardData?.effects?.description) ? cardData.effects.description : [];
  const descText = desc.join(" ").toLowerCase();
  const ruleText = (effectRule?.parameters?.text ?? "").toString().toLowerCase();
  return descText.includes("during link") || ruleText.includes("during link");
}

function ruleRequiresSelfRested(effectRule: any, card: any): boolean {
  const cardType = (card?.cardData?.cardType ?? "").toString().toLowerCase();
  if (cardType !== "unit") return false;
  const desc: string[] = Array.isArray(card?.cardData?.effects?.description) ? card.cardData.effects.description : [];
  const descText = desc.join(" ").toLowerCase();
  const ruleText = (effectRule?.parameters?.text ?? "").toString().toLowerCase();
  // UX gating heuristic: abilities that "set this Unit as active" are only meaningful when the unit is rested.
  return descText.includes("set this unit as active") || ruleText.includes("set this unit as active");
}

export function filterActivatedEffectRulesByAvailability(opts: {
  card: any;
  raw: any;
  playerId: string;
  rules: any[];
}) {
  const { card, raw, playerId, rules } = opts;
  return (rules ?? []).filter((rule) => {
    if (ruleRequiresDuringLink(rule, card?.cardData) && !isCardLinkedInPlay(card, raw, playerId)) return false;
    if (ruleRequiresSelfRested(rule, card) && card?.isRested !== true) return false;
    return true;
  });
}

