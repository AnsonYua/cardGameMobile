type PilotDesignationRule = {
  effectId?: string;
  action?: string;
  parameters?: Record<string, any>;
};

export function getCardEffectRules(cardData: any): any[] {
  const rules: any[] = Array.isArray(cardData?.effects?.rules) ? cardData.effects.rules : [];
  return rules;
}

export function findPilotDesignationRule(cardData: any): PilotDesignationRule | undefined {
  const rules = getCardEffectRules(cardData);
  return rules.find(
    (rule: any) =>
      rule?.effectId === "pilot_designation" ||
      rule?.effectId === "pilotDesignation" ||
      rule?.action === "designate_pilot",
  );
}

export function hasPilotDesignationRule(cardData: any): boolean {
  return Boolean(findPilotDesignationRule(cardData));
}

export function getPilotDesignationStats(cardData: any): { ap: number; hp: number } | null {
  const rule = findPilotDesignationRule(cardData);
  const params = rule?.parameters || {};
  const ap = Number(params.AP ?? params.ap);
  const hp = Number(params.HP ?? params.hp);
  return {
    ap: Number.isFinite(ap) ? ap : 0,
    hp: Number.isFinite(hp) ? hp : 0,
  };
}

