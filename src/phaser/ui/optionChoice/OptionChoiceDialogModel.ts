export type OptionChoiceDialogChoice = {
  index: number;
  mode?: "card" | "text";
  cardId?: string;
  label?: string;
  enabled?: boolean;
  interactionState?: "read_only" | "selectable";
};

export type NormalizedOptionChoice = {
  index: number;
  mode: "card" | "text";
  cardId?: string;
  label: string;
  enabled: boolean;
  interactionState: "read_only" | "selectable";
};

export function normalizeOptionChoices(choices: OptionChoiceDialogChoice[]): NormalizedOptionChoice[] {
  const raw = Array.isArray(choices) ? choices : [];
  return raw.map((choice, idx) => {
    const cardId = (choice.cardId ?? "").toString() || undefined;
    const mode: "card" | "text" = choice.mode === "text" ? "text" : cardId ? "card" : "text";
    const index = Number(choice.index ?? idx);
    const interactionState =
      mode === "card"
        ? choice.interactionState === "read_only"
          ? "read_only"
          : choice.enabled !== false
            ? "selectable"
            : "read_only"
        : "read_only";
    return {
      index,
      mode,
      cardId,
      label: (choice.label ?? "").toString() || `Option ${index + 1}`,
      enabled: choice.enabled !== false,
      interactionState,
    };
  });
}
