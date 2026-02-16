import type { CardDataResponse, CardListItem } from "./types";

export const safeJsonParse = <T,>(value: string | null, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

export const normalizeSetId = (value: string) => value.trim().toLowerCase();

export const getQueryParam = (key: string) => {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const raw = params.get(key);
  return raw ? raw.trim() : null;
};

export const toCardList = (payload: CardDataResponse | null): CardListItem[] => {
  const cards = payload?.cards && typeof payload.cards === "object" ? payload.cards : {};
  return Object.entries(cards).map(([id, card]) => ({ id, ...(card as any) }));
};

export const formatCardSubtitle = (card: any) => {
  const parts: string[] = [];
  if (card.cardType) parts.push(String(card.cardType));
  if (card.color) parts.push(String(card.color));
  if (typeof card.cost === "number") parts.push(`Cost ${card.cost}`);
  if (typeof card.level === "number") parts.push(`Lv ${card.level}`);
  const stats: string[] = [];
  if (typeof card.ap === "number") stats.push(`AP ${card.ap}`);
  if (typeof card.hp === "number") stats.push(`HP ${card.hp}`);
  if (stats.length > 0) parts.push(stats.join(" / "));
  return parts.join(" · ");
};

export const getCardPreviewPath = (setId: string, cardId: string) => `previews/${setId}/${cardId}.jpeg`;

export const buildApiImageUrl = (apiBaseUrl: string, imagePath: string) => {
  const base = typeof apiBaseUrl === "string" ? apiBaseUrl.replace(/\/+$/, "") : "";
  const cleanedPath = String(imagePath || "").replace(/^\/+/, "");
  if (!base) return `/api/game/image/${cleanedPath}`;
  return `${base}/api/game/image/${cleanedPath}`;
};
