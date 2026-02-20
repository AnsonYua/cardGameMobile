export type TutorTopDeckRevealCard = {
  carduid: string;
  cardId: string;
  name?: string;
  traits?: string[];
  matchesFilters?: boolean;
  step2Eligible?: boolean;
  interactionState?: "read_only" | "selectable";
};

export function isTutorTopDeckRevealPrompt(context: any): boolean {
  return (context?.kind ?? "").toString() === "TUTOR_TOP_DECK_REVEAL_CONFIRM";
}

export function getTutorTopDeckRevealCards(context: any): TutorTopDeckRevealCard[] {
  const cards = context?.tutor?.lookedCards;
  if (!Array.isArray(cards)) return [];
  return cards
    .filter((c: any) => !!c && typeof c === "object")
    .map((card: any) => ({
      ...card,
      step2Eligible: card?.matchesFilters === true,
      interactionState: card?.interactionState === "selectable" ? "selectable" : "read_only",
    }));
}

export function getTutorStep2EligibilityHint(card: TutorTopDeckRevealCard): string {
  return card.step2Eligible ? "Eligible in Step 2" : "Not eligible in Step 2";
}
