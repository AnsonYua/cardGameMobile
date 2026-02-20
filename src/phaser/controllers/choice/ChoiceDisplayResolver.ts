export type DisplayMode = "card" | "text";

export type ChoiceDisplay = {
  mode?: unknown;
  cardId?: unknown;
  label?: unknown;
};

export function parseDisplayMode(display?: ChoiceDisplay): DisplayMode | undefined {
  const mode = (display?.mode ?? "").toString().toLowerCase();
  if (mode === "card" || mode === "text") return mode;
  return undefined;
}

export function resolveChoiceCardId(
  display: ChoiceDisplay | undefined,
  payload: any,
  option: any,
  fallback?: () => string | undefined,
): string | undefined {
  const direct = display?.cardId ?? payload?.cardId ?? payload?.sourceCardId ?? payload?.source?.cardId ?? option?.cardId;
  const value = direct || fallback?.();
  return value ? String(value) : undefined;
}

export function resolveChoiceLabel(display: ChoiceDisplay | undefined, option: any): string | undefined {
  const value = (display?.label ?? option?.label ?? "").toString();
  return value || undefined;
}
