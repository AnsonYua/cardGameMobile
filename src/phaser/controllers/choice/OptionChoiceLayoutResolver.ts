export type OptionChoiceLayoutHint = "card" | "text" | "hybrid";
export type OptionChoiceLayoutChoice = {
  mode?: "card" | "text";
  cardId?: string;
};

export function resolveOptionChoiceLayout(
  choices: OptionChoiceLayoutChoice[],
  hint?: OptionChoiceLayoutHint,
): OptionChoiceLayoutHint {
  if (hint === "card" || hint === "text" || hint === "hybrid") return hint;
  const normalized = Array.isArray(choices) ? choices : [];
  const hasCard = normalized.some((choice) => {
    const mode = choice.mode === "text" ? "text" : "card";
    return mode === "card" && !!choice.cardId;
  });
  const hasText = normalized.some((choice) => {
    const mode = choice.mode === "text" ? "text" : "card";
    return mode === "text" || !choice.cardId;
  });
  if (hasCard && hasText) return "hybrid";
  if (hasCard) return "card";
  return "text";
}
