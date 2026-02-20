export type TutorTopDeckRevealCard = {
  carduid: string;
  cardId: string;
  name?: string;
  traits?: string[];
  matchesFilters?: boolean;
};

export function isTutorTopDeckRevealPrompt(context: any): boolean {
  return (context?.kind ?? "").toString() === "TUTOR_TOP_DECK_REVEAL_CONFIRM";
}

export function getTutorTopDeckRevealCards(context: any): TutorTopDeckRevealCard[] {
  const cards = context?.tutor?.lookedCards;
  return Array.isArray(cards) ? cards.filter((c: any) => !!c && typeof c === "object") : [];
}
