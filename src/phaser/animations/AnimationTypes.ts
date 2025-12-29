import type { SlotNotification } from "./NotificationAnimationController";
import type { SlotCardView, SlotOwner, SlotPositionMap, SlotViewModel } from "../ui/SlotTypes";

export type AnimationEventType =
  | "CARD_PLAYED"
  | "UNIT_ATTACK_DECLARED"
  | "BATTLE_RESOLVED"
  | "CARD_STAT_MODIFIED";

export type AnimationEvent = {
  id: string;
  type: AnimationEventType;
  note: SlotNotification;
  cardUids: string[];
};

export type CardLookup = {
  findBaseCard: (playerId?: string) => any;
  findCardByUid: (cardUid?: string) => SlotCardView | undefined;
};

export type AnimationContext = {
  notificationQueue: SlotNotification[];
  slots: SlotViewModel[];
  boardSlotPositions?: SlotPositionMap;
  allowAnimations: boolean;
  currentPlayerId: string | null;
  resolveSlotOwnerByPlayer: (playerId?: string) => SlotOwner | undefined;
  cardLookup: CardLookup;
};
