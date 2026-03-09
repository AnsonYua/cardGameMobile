export type FrontendCompiledEffectNode = {
  structure?: string;
  operation?: string;
  playMode?: string;
  metaRef?: {
    type?: string;
    abilityType?: string;
  };
  aiTags?: {
    mechanical?: string[];
    strategic?: string[];
  };
};

type RuleLike = {
  action?: string;
  compiledEffectNode?: FrontendCompiledEffectNode | null;
  effectId?: string;
};

export function getCompiledEffectNode(rule: RuleLike | null | undefined): FrontendCompiledEffectNode | undefined {
  if (rule?.compiledEffectNode && typeof rule.compiledEffectNode === "object") {
    return rule.compiledEffectNode;
  }
  return undefined;
}

export function getLegacyAction(rule: RuleLike | null | undefined): string | undefined {
  const node = getCompiledEffectNode(rule);
  if (node?.structure === "sequence" || node?.structure === "conditional") {
    return node.structure;
  }
  if (typeof node?.playMode === "string" && node.playMode) {
    return node.playMode;
  }
  if (typeof node?.metaRef?.type === "string" && node.metaRef.type) {
    return node.metaRef.type;
  }
  if (typeof node?.operation === "string" && node.operation) {
    return node.operation;
  }
  if (typeof rule?.action === "string" && rule.action) {
    return rule.action;
  }
  return undefined;
}

export function isPilotDesignationRule(rule: RuleLike | null | undefined): boolean {
  const node = getCompiledEffectNode(rule);
  if (node?.playMode === "designate_pilot") {
    return true;
  }
  return (
    rule?.effectId === "pilot_designation" ||
    rule?.effectId === "pilotDesignation" ||
    getLegacyAction(rule) === "designate_pilot"
  );
}
