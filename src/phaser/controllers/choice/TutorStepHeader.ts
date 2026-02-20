import { isTutorTopDeckRevealPrompt } from "./TutorTopDeckRevealContext";

function hasStepMarker(headerText: string): boolean {
  return /\(Step\s+\d+\s*\/\s*\d+\)$/i.test(headerText.trim());
}

export function withTutorRevealStepHeader(headerText: string, context: any): string {
  const header = (headerText || "Top of Deck").toString();
  if (!isTutorTopDeckRevealPrompt(context) || hasStepMarker(header)) return header;
  return `${header} (Step 1/2)`;
}

export function withTutorSelectionStepHeader(headerText: string, context: any): string {
  const header = (headerText || "Choose Option").toString();
  const hasTutorContext = Array.isArray(context?.tutor?.lookedCarduids) || Array.isArray(context?.tutor?.lookedCards);
  if (!hasTutorContext || hasStepMarker(header)) return header;
  return `${header} (Step 2/2)`;
}
