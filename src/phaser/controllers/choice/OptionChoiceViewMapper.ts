import { resolveOptionCardId } from "./OptionChoiceCardResolver";
import { parseDisplayMode, resolveChoiceCardId, resolveChoiceLabel } from "./ChoiceDisplayResolver";

export type OptionDialogChoiceView = {
  index: number;
  mode: "card" | "text";
  cardId?: string;
  label?: string;
  enabled: boolean;
  interactionState?: "read_only" | "selectable";
};

export function mapOptionChoiceToDialogView(raw: any, option: any): OptionDialogChoiceView {
  const display = option?.display && typeof option.display === "object" ? option.display : {};
  const payload = option?.payload ?? {};
  const modeFromContract = parseDisplayMode(display);
  const cardId = resolveChoiceCardId(display, payload, option, () => resolveOptionCardId(raw, option));

  const inferredMode: "card" | "text" = cardId ? "card" : "text";
  const mode = modeFromContract ?? inferredMode;
  const label = resolveChoiceLabel(display, option);

  return {
    index: Number(option?.index ?? 0),
    mode,
    cardId: cardId ? String(cardId) : undefined,
    label,
    enabled: option?.enabled !== false,
    interactionState: mode === "card" && option?.enabled !== false ? "selectable" : "read_only",
  };
}
