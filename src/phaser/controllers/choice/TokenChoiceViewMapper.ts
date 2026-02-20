import { resolveChoiceCardId } from "./ChoiceDisplayResolver";

export type TokenDialogChoiceView = {
  index: number;
  cardId?: string;
  enabled: boolean;
};

export function mapTokenChoiceToDialogView(choice: any): TokenDialogChoiceView {
  const display = choice?.display && typeof choice.display === "object" ? choice.display : {};
  const payload = choice?.payload ?? {};
  const cardId = resolveChoiceCardId(display, payload, choice, () => {
    const fallback = choice?.tokenData?.id ?? choice?.token?.cardId;
    return fallback ? String(fallback) : undefined;
  });

  return {
    index: Number(choice?.index ?? 0),
    cardId,
    enabled: choice?.enabled !== false,
  };
}
