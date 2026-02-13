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

const stripPathAndExtension = (id: string) => {
  const base = id.split("/").pop() ?? id;
  return base.replace(/\.(png|jpe?g)$/i, "");
};

export const toBaseKey = (cardId?: string | null) => (cardId ? stripPathAndExtension(cardId) : undefined);

export const toPreviewKey = (cardId?: string | null) =>
  cardId ? stripPathAndExtension(cardId) + "-preview" : undefined;
