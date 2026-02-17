import { useEffect, useRef, useState } from "react";
import { ApiError, type ApiManager, type CardSetSummary, type TopDeckItem } from "../../phaser/api/ApiManager";
import { DEFAULT_SETS } from "./constants";
import type { CardDataResponse, DeckEntry } from "./types";
import { safeJsonParse } from "./utils";
import { STORAGE_DECK } from "./constants";

export function useCardSets(api: ApiManager) {
  const [sets, setSets] = useState<CardSetSummary[]>(DEFAULT_SETS);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;
    const loadSets = async () => {
      try {
        setStatus("loading");
        setError(null);
        const response = await api.getCardSets();
        if (!isActive) return;
        const next = Array.isArray(response.sets) && response.sets.length > 0 ? response.sets : DEFAULT_SETS;
        setSets(next);
        setStatus("idle");
      } catch (err) {
        if (!isActive) return;
        setSets(DEFAULT_SETS);
        setStatus("error");
        setError(err instanceof Error ? err.message : "Unable to load card sets.");
      }
    };

    loadSets();
    return () => {
      isActive = false;
    };
  }, [api]);

  return { sets, status, error };
}

export function useCardsBySet(api: ApiManager, selectedSet: string) {
  const [cardsBySet, setCardsBySet] = useState<Record<string, CardDataResponse>>({});
  const [statusBySet, setStatusBySet] = useState<Record<string, "idle" | "loading" | "error">>({});
  const [errorBySet, setErrorBySet] = useState<Record<string, string | null>>({});

  useEffect(() => {
    let isActive = true;
    const loadCards = async (setId: string) => {
      if (cardsBySet[setId]) return;
      setStatusBySet((prev) => ({ ...prev, [setId]: "loading" }));
      setErrorBySet((prev) => ({ ...prev, [setId]: null }));
      try {
        const payload = await api.getCardsBySet(setId);
        if (!isActive) return;
        setCardsBySet((prev) => ({ ...prev, [setId]: payload }));
        setStatusBySet((prev) => ({ ...prev, [setId]: "idle" }));
      } catch (err) {
        // Back-compat: older backend served only st01 via GET /api/game/cards
        if (setId === "st01") {
          try {
            const payload = await api.getCardData();
            if (!isActive) return;
            setCardsBySet((prev) => ({ ...prev, [setId]: payload }));
            setStatusBySet((prev) => ({ ...prev, [setId]: "idle" }));
            return;
          } catch {
            // fall through
          }
        }

        if (!isActive) return;
        const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Unable to load cards.";
        setStatusBySet((prev) => ({ ...prev, [setId]: "error" }));
        setErrorBySet((prev) => ({ ...prev, [setId]: message }));
      }
    };

    void loadCards(selectedSet);
    return () => {
      isActive = false;
    };
  }, [api, selectedSet, cardsBySet]);

  return {
    cardsBySet,
    status: statusBySet[selectedSet] || "idle",
    error: errorBySet[selectedSet] || null,
  };
}

export function useDeckStorage() {
  const [deck, setDeck] = useState<DeckEntry[]>(() => safeJsonParse<DeckEntry[]>(window.localStorage.getItem(STORAGE_DECK), []));
  const lastDeckWrite = useRef<number>(0);

  useEffect(() => {
    // Cheap throttling to avoid writing on every click burst.
    const now = Date.now();
    if (now - lastDeckWrite.current < 100) return;
    lastDeckWrite.current = now;
    window.localStorage.setItem(STORAGE_DECK, JSON.stringify(deck));
  }, [deck]);

  return { deck, setDeck };
}

export function useTopDeckPicker(api: ApiManager) {
  const [topDecks, setTopDecks] = useState<TopDeckItem[]>([]);
  const [topDeckStatus, setTopDeckStatus] = useState<"idle" | "loading" | "error">("idle");
  const [topDeckError, setTopDeckError] = useState<string | null>(null);
  const [topDeckOpen, setTopDeckOpen] = useState(false);

  const loadTopDecks = async () => {
    if (topDeckStatus === "loading") return;
    setTopDeckStatus("loading");
    setTopDeckError(null);
    try {
      const response = await api.getTopDecks();
      setTopDecks(Array.isArray(response.decks) ? response.decks : []);
      setTopDeckStatus("idle");
    } catch (err) {
      setTopDeckStatus("error");
      setTopDeckError(err instanceof Error ? err.message : "Unable to load top decks.");
    }
  };

  const toggleTopDeck = () => {
    const nextOpen = !topDeckOpen;
    setTopDeckOpen(nextOpen);
    if (nextOpen && topDecks.length === 0 && topDeckStatus !== "loading") {
      void loadTopDecks();
    }
  };

  const closeTopDeck = () => setTopDeckOpen(false);
  const clearTopDeckError = () => setTopDeckError(null);

  return {
    topDecks,
    topDeckStatus,
    topDeckError,
    topDeckOpen,
    toggleTopDeck,
    closeTopDeck,
    clearTopDeckError,
  };
}
