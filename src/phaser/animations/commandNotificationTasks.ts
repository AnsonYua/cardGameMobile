import { toBaseKey, type HandCardView } from "../ui/HandTypes";
import type { SlotCardView } from "../ui/SlotTypes";

type CommandPopupDeps = {
  animateCommand: (payload: any, isSelf: boolean, card?: SlotCardView) => Promise<void>;
  buildPopupCardData: (card?: SlotCardView, fallbackUid?: string) => any;
  buildPreviewCard: (card?: SlotCardView) => HandCardView | null;
  showCommandPopup: (preview: HandCardView, popupCard: any, header: string) => Promise<void>;
};

export function createCommandPlayedTask(
  payload: any,
  isSelf: boolean,
  card: SlotCardView | undefined,
  deps: CommandPopupDeps,
): () => Promise<void> {
  return async () => {
    await deps.animateCommand(payload, isSelf, card);
    if (isSelf) return;
    const popupCard = deps.buildPopupCardData(card, payload?.carduid);
    const preview = deps.buildPreviewCard(card) ?? buildFallbackCommandPreview(payload?.carduid);
    await deps.showCommandPopup(preview, popupCard, "Opponent Played Card");
  };
}

function buildFallbackCommandPreview(fallbackUid?: string): HandCardView {
  const fallbackCardId = extractCardIdFromUid(fallbackUid);
  return {
    color: 0x2a2d38,
    textureKey: toBaseKey(fallbackCardId),
    cardType: "command",
    cardId: fallbackCardId,
    ap: 0,
    hp: 0,
  };
}

function extractCardIdFromUid(cardUid?: string) {
  if (!cardUid) return "card";
  const uid = String(cardUid);
  const split = uid.split("_");
  return split[0] || uid;
}
