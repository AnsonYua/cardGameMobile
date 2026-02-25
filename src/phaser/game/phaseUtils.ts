export function normalizePhaseToken(value: unknown): string {
  const raw = (value ?? "").toString().trim().toUpperCase();
  if (!raw) return "";
  return raw.endsWith("_PHASE") ? raw.slice(0, -"_PHASE".length) : raw;
}

export function phaseEquals(value: unknown, expected: string): boolean {
  return normalizePhaseToken(value) === normalizePhaseToken(expected);
}

export function isMainPhase(value: unknown): boolean {
  return phaseEquals(value, "MAIN_PHASE");
}

export function isActionStepPhase(value: unknown): boolean {
  return phaseEquals(value, "ACTION_STEP");
}

export function isBlockerPhase(value: unknown): boolean {
  return phaseEquals(value, "BLOCKER_PHASE");
}
