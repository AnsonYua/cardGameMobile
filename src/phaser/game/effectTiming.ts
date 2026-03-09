import { normalizePhaseToken } from "./phaseUtils";

type EffectRuleLike = {
  type?: string;
  trigger?: string;
  timing?: {
    eventTrigger?: string;
    activationWindows?: string[];
    windows?: string[];
    duration?: string;
    [key: string]: unknown;
  };
  compiledTiming?: {
    eventTrigger?: string;
    activationWindows?: string[];
    duration?: string;
    timingClass?: string;
    [key: string]: unknown;
  };
  action?: string;
  [key: string]: unknown;
};

function normalizeArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
  }
  if (typeof value === "string" && value.length > 0) {
    return [value];
  }
  return [];
}

export function getCompiledTiming(rule: EffectRuleLike | null | undefined) {
  if (!rule || typeof rule !== "object") return undefined;
  const timing = rule.compiledTiming;
  return timing && typeof timing === "object" ? timing : undefined;
}

export function getEffectActivationWindows(rule: EffectRuleLike | null | undefined): string[] {
  if (!rule || typeof rule !== "object") return [];
  const compiledTiming = getCompiledTiming(rule);
  const explicit = [
    ...normalizeArray(compiledTiming?.activationWindows),
    ...normalizeArray(rule?.timing?.activationWindows),
    ...normalizeArray(rule?.timing?.windows),
  ];
  if (explicit.length > 0) {
    return Array.from(new Set(explicit));
  }

  const trigger = typeof rule.trigger === "string" ? rule.trigger.toUpperCase() : "";
  if (trigger === "MAIN_PHASE" || trigger === "ACTION_STEP") {
    return [trigger];
  }

  const ruleType = (rule.type || "").toString().toLowerCase();
  const action = (rule.action || "").toString().toLowerCase();
  if (ruleType === "special" && action === "designate_pilot") {
    return ["MAIN_PHASE"];
  }
  if ((ruleType === "play" || ruleType === "activated") && !getEffectEventTrigger(rule)) {
    return ["MAIN_PHASE"];
  }

  return [];
}

export function getEffectEventTrigger(rule: EffectRuleLike | null | undefined): string | undefined {
  if (!rule || typeof rule !== "object") return undefined;
  const compiledTiming = getCompiledTiming(rule);
  if (typeof compiledTiming?.eventTrigger === "string" && compiledTiming.eventTrigger.length > 0) {
    return compiledTiming.eventTrigger;
  }
  if (typeof rule?.timing?.eventTrigger === "string" && rule.timing.eventTrigger.length > 0) {
    return rule.timing.eventTrigger;
  }
  if (typeof rule.trigger === "string" && rule.trigger.length > 0) {
    const trigger = rule.trigger.toUpperCase();
    if (trigger !== "MAIN_PHASE" && trigger !== "ACTION_STEP") {
      return trigger;
    }
  }
  return undefined;
}

export function hasEffectActivationWindow(
  rule: EffectRuleLike | null | undefined,
  phase?: string | null,
) {
  const currentPhase = normalizePhaseToken(phase);
  if (!currentPhase) return false;
  return getEffectActivationWindows(rule).some((window) => normalizePhaseToken(window) === currentPhase);
}
