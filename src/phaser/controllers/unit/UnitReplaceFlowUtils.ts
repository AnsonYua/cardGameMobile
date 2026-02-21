import type { SlotPresenter } from "../../ui/SlotPresenter";
import type { SlotViewModel } from "../../ui/SlotTypes";

export const UNIT_BOARD_FULL_REPLACE_MESSAGE = "Board is full. Choose a slot to replace.";

export function isBoardFullReplacePromptError(err: any) {
  const message = (err?.message ?? "").toString();
  return message.includes(UNIT_BOARD_FULL_REPLACE_MESSAGE);
}

export function toUserFacingActionError(err: any) {
  const rawMessage = (err?.message ?? "").toString();
  if (rawMessage) return rawMessage;
  return "Request failed.";
}

export function collectReplaceCandidates(raw: any, playerId: string | null | undefined, slotPresenter: SlotPresenter): SlotViewModel[] {
  if (!raw || !playerId) return [];
  const slots = slotPresenter.toSlots(raw, playerId);
  return slots.filter((slot) => slot.owner === "player" && !!slot.unit);
}
