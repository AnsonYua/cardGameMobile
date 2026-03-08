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

export const toFullKey = (cardId?: string | null) => (cardId ? stripPathAndExtension(cardId) : undefined);

export const toThumbKey = (cardId?: string | null) => {
  const fullKey = toFullKey(cardId);
  return fullKey ? `${fullKey}-thumb` : undefined;
};

export const toFullTextureKey = (textureKey?: string | null) =>
  textureKey ? String(textureKey).replace(/-thumb$/i, "") : undefined;
