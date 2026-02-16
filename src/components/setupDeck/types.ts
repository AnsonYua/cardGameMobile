export type CardDataResponse = {
  metadata?: Record<string, unknown>;
  cards?: Record<string, any>;
};

export type DeckEntry = {
  id: string;
  qty: number;
  setId?: string;
  name?: string;
};

export type CardListItem = { id: string } & Record<string, any>;
