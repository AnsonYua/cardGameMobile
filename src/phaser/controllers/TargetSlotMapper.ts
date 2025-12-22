import { toPreviewKey } from "../ui/HandTypes";
import type { SlotCardView, SlotOwner, SlotViewModel } from "../ui/SlotTypes";
import type { SlotPresenter } from "../ui/SlotPresenter";

export type SlotTarget = {
  slot: SlotViewModel;
  data: any;
};

export function mapAvailableTargetsToSlotTargets(
  slotPresenter: SlotPresenter,
  raw: any,
  availableTargets: any[],
  selfPlayerId: string,
): SlotTarget[] {
  if (!raw || !Array.isArray(availableTargets) || !availableTargets.length) return [];

  const allSlots = slotPresenter.toSlots(raw, selfPlayerId);
  const mapped: SlotTarget[] = [];

  availableTargets.forEach((target) => {
    if (!target) return;
    const owner: SlotOwner = target.playerId === selfPlayerId ? "player" : "opponent";
    const zone = target.zone || "";
    const existing = allSlots.find((slot) => slot.owner === owner && slot.slotId === zone);
    if (existing) {
      mapped.push({ slot: existing, data: target });
      return;
    }
    const slotView: SlotViewModel = {
      owner,
      slotId: zone || "unknown",
      fieldCardValue: {
        totalAP: target.cardData?.ap ?? 0,
        totalHP: target.cardData?.hp ?? 0,
      },
    };
    const cardView = buildSlotCardView(target);
    if (cardView) {
      const cardType = (cardView.cardType || "").toLowerCase();
      if (cardType === "pilot" || cardType === "command") {
        slotView.pilot = cardView;
      } else {
        slotView.unit = cardView;
      }
    }
    mapped.push({ slot: slotView, data: target });
  });

  return mapped;
}

function buildSlotCardView(target: any): SlotCardView | undefined {
  const cardId = target.cardData?.id || target.carduid || target.cardUid || target.uid || target.id;
  if (!cardId) return undefined;
  return {
    id: cardId,
    cardType: target.cardData?.cardType,
    textureKey: toPreviewKey(cardId),
    cardUid: target.carduid ?? target.cardUid ?? undefined,
    cardData: target.cardData,
  };
}
