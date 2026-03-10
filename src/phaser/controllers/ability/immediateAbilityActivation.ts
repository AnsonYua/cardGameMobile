import { findBaseCard } from "../../utils/CardLookup";
import { resolveCardUid } from "../../utils/CardUid";
import { getActivatedEffectOptions, getSlotCards } from "../../game/actionEligibility";

export type ImmediateAbilityActivation = {
  carduid: string;
  effectId: string;
};

export function resolveImmediateAbilityActivation(input: {
  raw: any;
  selection: any;
  playerId?: string | null;
}): ImmediateAbilityActivation | undefined {
  const { raw, selection, playerId } = input;
  if (!raw || !selection || !playerId) return undefined;

  const enabled: ImmediateAbilityActivation[] = [];
  const pushEnabled = (card: any, carduid?: string) => {
    const resolvedUid = (carduid ?? resolveCardUid(card) ?? "").toString();
    if (!card || !resolvedUid) return;
    const options = getActivatedEffectOptions(card, raw, playerId).filter((option) => option.enabled === true);
    options.forEach((option) => {
      enabled.push({ carduid: resolvedUid, effectId: option.effectId });
    });
  };

  if (selection.kind === "slot") {
    if (selection.owner !== "player") return undefined;
    const slotCards = getSlotCards(selection, raw, playerId);
    pushEnabled(slotCards?.unit, slotCards?.unit?.carduid);
    pushEnabled(slotCards?.pilot, slotCards?.pilot?.carduid);
    return enabled.length === 1 ? enabled[0] : undefined;
  }

  if (selection.kind === "base") {
    if (selection.side !== "player") return undefined;
    const baseCard = findBaseCard(raw, playerId);
    pushEnabled(baseCard, baseCard?.carduid);
    return enabled.length === 1 ? enabled[0] : undefined;
  }

  return undefined;
}
