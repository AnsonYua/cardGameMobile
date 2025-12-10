export type HandCardView = {
  color: number;
  textureKey?: string;
  cost?: number | string;
  ap?: number;
  hp?: number;
  cardType?: string;
  uid?: string;
  fromPilotDesignation?: boolean;
  cardId?: string;
};

export const toPreviewKey = (cardId?: string | null) =>
  cardId ? cardId.replace(/\.png$/i, "") + "-preview" : undefined;
