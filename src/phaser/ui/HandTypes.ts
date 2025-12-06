export type HandCardView = { color: number; cost?: string; textureKey?: string };

export const toPreviewKey = (id?: string | null) => (id ? id.replace(/\.png$/i, "") + "-preview" : undefined);
