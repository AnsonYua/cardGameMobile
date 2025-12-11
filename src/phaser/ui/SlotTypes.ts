export type SlotOwner = "player" | "opponent";

export type SlotCardView = {
  id?: string;
  textureKey?: string;
  cardType?: string;
  isRested?: boolean;
  cardData?: any;
  cardUid?: string;
};

export type SlotViewModel = {
  owner: SlotOwner;
  slotId: string;
  unit?: SlotCardView;
  pilot?: SlotCardView;
  isRested?: boolean;
  ap?: number;
  hp?: number;
  fieldCardValue?: { totalAP?: number; totalHP?: number };
};

export type SlotPosition = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  isOpponent: boolean;
};

export type SlotPositionMap = {
  player: Record<string, SlotPosition>;
  opponent: Record<string, SlotPosition>;
};
