export type StoredDeckEntry = {
  id: string;
  qty: number;
  setId?: string;
  name?: string;
};

const STORAGE_DECK_KEY = "setupDeck.deck";

export function readDeckFromStorage(): StoredDeckEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_DECK_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry) => entry && typeof entry.id === "string" && Number(entry.qty) > 0)
      .map((entry) => ({
        id: String(entry.id).trim().toUpperCase(),
        qty: Number(entry.qty),
        ...(typeof entry.setId === "string" && entry.setId.trim().length > 0 ? { setId: entry.setId.trim().toLowerCase() } : {}),
        ...(typeof entry.name === "string" && entry.name.trim().length > 0 ? { name: entry.name.trim() } : {}),
      }));
  } catch {
    return [];
  }
}
