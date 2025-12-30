import type { SlotNotification } from "./NotificationAnimationController";
import type { SlotCardView, SlotOwner, SlotPositionMap, SlotViewModel } from "../ui/SlotTypes";

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
  getRenderSlots?: () => SlotViewModel[];
  previousRaw?: any;
  currentRaw?: any;
};
