export type HandCardView = {
  color: number;
  textureKey?: string;
  cost?: number | string;
  ap?: number;
  hp?: number;
  cardType?: string;
  id?: string;
  fromPilotDesignation?: boolean;
};

export const toPreviewKey = (id?: string | null) => (id ? id.replace(/\.png$/i, "") + "-preview" : undefined);
