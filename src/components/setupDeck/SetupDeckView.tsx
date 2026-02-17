import { useEffect, useMemo, useState } from "react";
import { ApiManager, type TopDeckItem } from "../../phaser/api/ApiManager";
import { DEFAULT_SETS, STORAGE_DECK, STORAGE_SELECTED_SET } from "./constants";
import { useCardsBySet, useCardSets, useDeckStorage, useTopDeckPicker } from "./hooks";
import type { CardListItem } from "./types";
import { getQueryParam, normalizeSetId, toCardList } from "./utils";
import { TopBar } from "./TopBar";
import { DeckPanel } from "./DeckPanel";
import { CardBrowser } from "./CardBrowser";
import "./setupDeck.css";

export function SetupDeckView() {
  const api = useMemo(() => new ApiManager(), []);

  const { sets, status: setsStatus, error: setsError } = useCardSets(api);

  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveNote, setSaveNote] = useState<string | null>(null);

  const [selectedSet, setSelectedSet] = useState<string>(() => {
    const fromQuery = getQueryParam("set");
    if (fromQuery) return normalizeSetId(fromQuery);
    const saved = typeof window === "undefined" ? null : window.localStorage.getItem(STORAGE_SELECTED_SET);
    return saved ? normalizeSetId(saved) : DEFAULT_SETS[0].id;
  });

  const { deck, setDeck } = useDeckStorage();
  const { topDecks, topDeckStatus, topDeckError, topDeckOpen, toggleTopDeck, closeTopDeck, clearTopDeckError } =
    useTopDeckPicker(api);
  const [search, setSearch] = useState("");
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  const { cardsBySet, status: cardsStatus, error: cardsError } = useCardsBySet(api, selectedSet);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_SELECTED_SET, selectedSet);
  }, [selectedSet]);

  const cardsPayload = cardsBySet[selectedSet] || null;
  const allCards: CardListItem[] = toCardList(cardsPayload);

  const filteredCards = allCards.filter((c) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    const name = typeof c.name === "string" ? c.name.toLowerCase() : "";
    const id = typeof c.id === "string" ? c.id.toLowerCase() : "";
    return name.includes(q) || id.includes(q);
  });

  const deckCount = deck.reduce((sum, entry) => sum + entry.qty, 0);
  const deckById = new Map(deck.map((d) => [d.id, d.qty]));

  const changeDeck = (cardId: string, delta: number, meta?: { setId?: string; name?: string }) => {
    setDeck((prev) => {
      const next = [...prev];
      const idx = next.findIndex((e) => e.id === cardId);
      if (idx === -1) {
        if (delta <= 0) return prev;
        return [
          ...next,
          {
            id: cardId,
            qty: delta,
            ...(meta?.setId ? { setId: meta.setId } : {}),
            ...(meta?.name ? { name: meta.name } : {}),
          },
        ];
      }
      const updated = next[idx].qty + delta;
      if (updated <= 0) {
        next.splice(idx, 1);
        return next;
      }
      next[idx] = {
        ...next[idx],
        id: cardId,
        qty: updated,
        ...(meta?.setId ? { setId: meta.setId } : {}),
        ...(meta?.name ? { name: meta.name } : {}),
      };
      return next;
    });
  };

  const handleSave = async () => {
    setSaveStatus("saving");
    setSaveNote(null);
    try {
      window.localStorage.setItem(STORAGE_SELECTED_SET, selectedSet);
      window.localStorage.setItem(STORAGE_DECK, JSON.stringify(deck));
      setSaveStatus("saved");
      window.location.href = "/lobby";
    } catch (err) {
      setSaveStatus("error");
      setSaveNote(err instanceof Error ? err.message : "Save failed.");
    }
  };

  const applyTopDeck = (selected: TopDeckItem) => {
    const nextDeck = selected.entries.map(({ id, qty }) => ({ id, qty }));
    setDeck(nextDeck);
    closeTopDeck();
    setSaveStatus("idle");
    setSaveNote(`Loaded top deck: ${selected.name}`);
    clearTopDeckError();
  };

  return (
    <div className="page">
      <div className="deck-setup">
        <TopBar
          sets={sets}
          selectedSet={selectedSet}
          onSelectedSetChange={setSelectedSet}
          search={search}
          onSearchChange={setSearch}
          onSave={handleSave}
          saveDisabled={saveStatus === "saving" || deck.length === 0}
          saveLabel={saveStatus === "saving" ? "Saving..." : "Save"}
          saveNote={saveNote}
          saveNoteIsError={saveStatus === "error"}
          topDecks={topDecks}
          topDeckOpen={topDeckOpen}
          topDeckStatus={topDeckStatus}
          topDeckError={topDeckError}
          onTopDeckToggle={toggleTopDeck}
          onTopDeckSelect={applyTopDeck}
        />

        {(setsStatus === "error" || setsStatus === "loading") && (
          <div className="deck-setup-banner">
            {setsStatus === "loading" ? "Loading epics..." : `Epic list fallback: ${setsError}`}
          </div>
        )}

        <div className="deck-setup-body">
          <DeckPanel apiBaseUrl={api.getBaseUrl()} deck={deck} deckCount={deckCount} onChangeDeck={changeDeck} />
          <CardBrowser
            apiBaseUrl={api.getBaseUrl()}
            selectedSet={selectedSet}
            status={cardsStatus}
            errorMessage={cardsError}
            allCards={allCards}
            filteredCards={filteredCards}
            selectedCardId={selectedCardId}
            deckQtyById={deckById}
            onSelectCard={setSelectedCardId}
            onAddToDeck={(card) => changeDeck(card.id, 1, { setId: selectedSet, name: card.name })}
          />
        </div>
      </div>
    </div>
  );
}
