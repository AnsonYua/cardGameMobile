export type TopBottomDecisionChoice = {
  index: number;
  label?: string;
  enabled?: boolean;
  mode?: "card" | "text";
  cardId?: string;
  interactionState?: "read_only" | "selectable";
  action?: string;
};

export type TopBottomDecisionMeta = {
  topIndex: number;
  bottomIndex: number;
  topLabel: string;
  bottomLabel: string;
  topEnabled: boolean;
  bottomEnabled: boolean;
  cardChoice: {
    index: number;
    cardId: string;
    label: string;
    enabled: boolean;
    interactionState: "read_only" | "selectable";
  };
};

export function detectTopBottomDecision(choices: TopBottomDecisionChoice[]): TopBottomDecisionMeta | undefined {
  const normalized = Array.isArray(choices) ? choices : [];
  if (normalized.length !== 2) return undefined;

  const topChoice = normalized.find((choice) => resolveKind(choice) === "top");
  const bottomChoice = normalized.find((choice) => resolveKind(choice) === "bottom");
  if (!topChoice || !bottomChoice) return undefined;
  if (topChoice.index === bottomChoice.index) return undefined;

  const cardSource = normalized.find((choice) => !!choice.cardId);
  if (!cardSource?.cardId) return undefined;

  return {
    topIndex: Number(topChoice.index),
    bottomIndex: Number(bottomChoice.index),
    topLabel: topChoice.label?.toString() || "Top",
    bottomLabel: bottomChoice.label?.toString() || "Bottom",
    topEnabled: topChoice.enabled !== false,
    bottomEnabled: bottomChoice.enabled !== false,
    cardChoice: {
      index: Number(cardSource.index),
      cardId: String(cardSource.cardId),
      label: cardSource.label?.toString() || "Card",
      enabled: cardSource.enabled !== false,
      interactionState: cardSource.interactionState === "selectable" ? "selectable" : "read_only",
    },
  };
}

function resolveKind(choice: TopBottomDecisionChoice): "top" | "bottom" | undefined {
  const action = (choice.action ?? "").toString().toUpperCase();
  if (action === "TOP") return "top";
  if (action === "BOTTOM") return "bottom";

  const label = (choice.label ?? "").toString().toLowerCase();
  if (/\bbottom\b/.test(label)) return "bottom";
  if (/\btop\b/.test(label)) return "top";
  return undefined;
}
