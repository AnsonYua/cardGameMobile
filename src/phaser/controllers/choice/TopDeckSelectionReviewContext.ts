export type TopDeckSelectionReviewCard = {
  carduid: string;
  cardId: string;
  name?: string;
  traits?: string[];
  matchesFilters?: boolean;
  step2Eligible?: boolean;
  interactionState?: "read_only" | "selectable";
};

export function isTopDeckSelectionReviewPrompt(context: any): boolean {
  const kind = (context?.kind ?? "").toString();
  return kind === "TOP_DECK_SELECTION_REVIEW_CONFIRM";
}

export function getTopDeckSelectionReviewCards(context: any): TopDeckSelectionReviewCard[] {
  const cards = Array.isArray(context?.topDeckSelection?.lookedCards) ? context.topDeckSelection.lookedCards : [];
  if (!Array.isArray(cards)) return [];
  return cards
    .filter((c: any) => !!c && typeof c === "object")
    .map((card: any) => ({
      ...card,
      step2Eligible: card?.matchesFilters === true,
      interactionState: card?.interactionState === "selectable" ? "selectable" : "read_only",
    }));
}

export function getTopDeckSelectionStep2EligibilityHint(card: TopDeckSelectionReviewCard): string {
  return card.step2Eligible ? "Eligible in Step 2" : "Not eligible in Step 2";
}
