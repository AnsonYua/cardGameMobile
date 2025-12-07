import { toPreviewKey } from "./HandTypes";
import { SlotCardView, SlotOwner, SlotViewModel } from "./SlotTypes";

const SLOT_KEYS = ["slot1", "slot2", "slot3", "slot4", "slot5", "slot6"];

export class SlotPresenter {
  toSlots(raw: any, selfPlayerId: string): SlotViewModel[] {
    const players = raw?.gameEnv?.players ?? {};
    const ids = Object.keys(players);
    if (!ids.length) return [];

    const localId = players[selfPlayerId] ? selfPlayerId : ids[0];
    const opponentId = ids.find((id) => id !== localId);

    const slots: SlotViewModel[] = [];
    slots.push(...this.buildSlots(players[localId], "player"));
    if (opponentId) {
      slots.push(...this.buildSlots(players[opponentId], "opponent"));
    }
    return slots;
  }

  private buildSlots(playerPayload: any, owner: SlotOwner): SlotViewModel[] {
    const zones = playerPayload?.zones ?? {};
    const results: SlotViewModel[] = [];
    SLOT_KEYS.forEach((slotId) => {
      const slot = zones?.[slotId];
      if (!slot) return;
      const unit = this.toCard(slot.unit);
      const pilot = this.toCard(slot.pilot);
      if (!unit && !pilot) return;
      const fieldCardValue = slot.fieldCardValue || {};
      results.push({
        owner,
        slotId,
        unit,
        pilot,
        isRested: slot.unit?.isRested ?? slot.fieldCardValue?.isRested ?? false,
        ap: fieldCardValue.totalAP ?? 0,
        hp: fieldCardValue.totalHP ?? 0,
        fieldCardValue,
      });
    });
    return results;
  }

  private toCard(card: any): SlotCardView | undefined {
    if (!card) return undefined;
    const id = typeof card === "string" ? card : card.cardId;
    const textureKey = toPreviewKey(id);
    const cardType = typeof card === "string" ? undefined : card.cardData?.cardType;
    return { id, textureKey, cardType, isRested: card?.isRested };
  }
}
