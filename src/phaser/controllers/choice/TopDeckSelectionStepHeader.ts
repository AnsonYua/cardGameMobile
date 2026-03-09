import { isTopDeckSelectionReviewPrompt } from "./TopDeckSelectionReviewContext";

function hasStepMarker(headerText: string): boolean {
  return /\(Step\s+\d+\s*\/\s*\d+\)$/i.test(headerText.trim());
}

export function withTopDeckSelectionReviewStepHeader(headerText: string, context: any): string {
  const header = (headerText || "Top of Deck").toString();
  if (!isTopDeckSelectionReviewPrompt(context) || hasStepMarker(header)) return header;
  return `${header} (Step 1/2)`;
}

export function withTopDeckSelectionOptionStepHeader(headerText: string, context: any): string {
  const header = (headerText || "Choose Option").toString();
  const hasTopDeckSelectionContext =
    Array.isArray(context?.topDeckSelection?.lookedCarduids) || Array.isArray(context?.topDeckSelection?.lookedCards);
  if (!hasTopDeckSelectionContext || hasStepMarker(header)) return header;
  return `${header} (Step 2/2)`;
}
