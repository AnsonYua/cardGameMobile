import { findCardByUid } from "../../utils/CardLookup";

function firstNonEmpty(items: unknown[]): string | undefined {
  for (const item of items) {
    if (typeof item === "string" && item.trim()) return item.trim();
  }
  return undefined;
}

function readEffectDescription(effect: any): string | undefined {
  if (!effect || typeof effect !== "object") return undefined;
  const direct = effect.description;
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  if (Array.isArray(direct)) {
    const fromArray = firstNonEmpty(direct);
    if (fromArray) return fromArray;
  }
  const text = effect?.parameters?.text;
  if (typeof text === "string" && text.trim()) return text.trim();
  return undefined;
}

function collectEffectIds(choice: any, data: any): string[] {
  const ids = [
    choice?.effectId,
    data?.effect?.effectId,
    data?.context?.ctx?.sequenceEffectId,
    data?.context?.sequenceEffectId,
  ]
    .filter((v) => typeof v === "string" && v.trim())
    .map((v) => v.trim());
  return Array.from(new Set(ids));
}

function normalize(value: unknown): string {
  return (value ?? "").toString().trim().toLowerCase();
}

function findFallbackDescriptionByRuleShape(
  rules: any[],
  descriptions: any[],
  data: any,
): string | undefined {
  const effect = data?.effect ?? {};
  const expectedAction = normalize(effect?.action);
  const expectedTrigger = normalize(effect?.trigger);

  if (!expectedAction && !expectedTrigger) return undefined;

  const matchingIndexes = rules
    .map((rule, index) => ({ rule, index }))
    .filter(({ rule }) => {
      const action = normalize(rule?.action);
      const trigger = normalize(rule?.trigger);
      if (expectedAction && action !== expectedAction) return false;
      if (expectedTrigger && trigger !== expectedTrigger) return false;
      return true;
    })
    .map(({ index }) => index);

  if (matchingIndexes.length !== 1) return undefined;

  const mapped = descriptions[matchingIndexes[0]];
  if (typeof mapped === "string" && mapped.trim()) return mapped.trim();
  const text = rules[matchingIndexes[0]]?.parameters?.text;
  if (typeof text === "string" && text.trim()) return text.trim();
  return undefined;
}

export function resolveTargetChoiceEffectDescription(opts: { raw: any; payload: any; data: any }): string | undefined {
  const choice = opts?.payload?.choice ?? {};
  const data = opts?.data ?? {};
  const directEffectText = readEffectDescription(data?.effect);
  if (directEffectText) return directEffectText;

  const sourceCarduid = (choice?.sourceCarduid ?? data?.sourceCarduid ?? "").toString();
  if (!sourceCarduid) return undefined;
  const sourceCard = findCardByUid(opts.raw, sourceCarduid);
  const rules: any[] = Array.isArray(sourceCard?.cardData?.effects?.rules) ? sourceCard.cardData.effects.rules : [];
  const descriptions: any[] = Array.isArray(sourceCard?.cardData?.effects?.description)
    ? sourceCard.cardData.effects.description
    : [];
  if (!rules.length || !descriptions.length) return undefined;

  const effectIds = collectEffectIds(choice, data);
  for (const effectId of effectIds) {
    const index = rules.findIndex((rule) => (rule?.effectId ?? "").toString() === effectId);
    if (index < 0) continue;
    const mapped = descriptions[index];
    if (typeof mapped === "string" && mapped.trim()) return mapped.trim();
    const ruleText = rules[index]?.parameters?.text;
    if (typeof ruleText === "string" && ruleText.trim()) return ruleText.trim();
  }

  const byRuleShape = findFallbackDescriptionByRuleShape(rules, descriptions, data);
  if (byRuleShape) return byRuleShape;

  return firstNonEmpty(descriptions);
}
