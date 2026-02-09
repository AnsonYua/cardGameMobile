import { toPreviewKey } from "../ui/HandTypes";
import type { SlotCardView, SlotOwner, SlotViewModel } from "../ui/SlotTypes";
import type { SlotPresenter } from "../ui/SlotPresenter";
import { isDebugFlagEnabled } from "../utils/debugFlags";
import { resolveTargetTotals } from "./targeting/TargetTotals";

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
  const debug = isDebugFlagEnabled("debugTargets");

  availableTargets.forEach((target) => {
    if (!target) return;
    const owner: SlotOwner = target.playerId === selfPlayerId ? "player" : "opponent";
    const zone = (target.zone || target.location || target.zoneType || "").toString();
    const existing = allSlots.find((slot) => slot.owner === owner && slot.slotId === zone);
    if (existing) {
      // IMPORTANT:
      // Multiple selectable targets can share the same logical board "slot" (e.g. selecting multiple
      // cards from the trash zone). If we reuse the same SlotViewModel instance, the UI can't
      // uniquely identify selections and the API mapping collapses to a single target.
      // Clone the slot and stamp the target cardUid onto it so each entry is unique.
      const computed = resolveTargetTotals(target);
      const slotView: SlotViewModel = {
        ...existing,
        unit: undefined,
        pilot: undefined,
        fieldCardValue: {
          totalAP: computed.totalAP ?? existing.fieldCardValue?.totalAP ?? 0,
          totalHP: computed.totalHP ?? existing.fieldCardValue?.totalHP ?? 0,
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
      return;
    }
    if (debug) {
      // eslint-disable-next-line no-console
      console.warn("[TargetSlotMapper] no existing slot match", {
        zone,
        owner,
        target: {
          carduid: target?.carduid ?? target?.cardUid,
          playerId: target?.playerId,
          zone: target?.zone,
          location: target?.location,
          zoneType: target?.zoneType,
          cardId: target?.cardData?.id,
          cardType: target?.cardData?.cardType,
        },
        knownSlots: allSlots.filter((s) => s.owner === owner).map((s) => s.slotId),
      });
    }
    const slotView: SlotViewModel = {
      owner,
      slotId: zone || "unknown",
      fieldCardValue: {
        ...resolveTargetTotals(target),
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
