import type { TopDeckItem } from "../../phaser/api/ApiManager";

type Props = {
  topDecks: TopDeckItem[];
  topDeckOpen: boolean;
  topDeckStatus: "idle" | "loading" | "error";
  onTopDeckToggle: () => void;
  onTopDeckSelect: (deck: TopDeckItem) => void;
};

export function TopDeckPicker({ topDecks, topDeckOpen, topDeckStatus, onTopDeckToggle, onTopDeckSelect }: Props) {
  const getDeckLabel = (deck: TopDeckItem, index: number) => {
    const raw = deck as TopDeckItem & Record<string, unknown>;
    const cardCountOnly = /^\s*\d+\s*cards?\s*$/i;
    const candidates = [raw.name, raw.deckName, raw.title, raw.setName, raw.id];
    for (const value of candidates) {
      if (typeof value !== "string") continue;
      const trimmed = value.trim();
      if (!trimmed) continue;
      if (!cardCountOnly.test(trimmed)) return trimmed;
    }
    return `Deck ${index + 1}`;
  };

  return (
    <div className="deck-setup-topdeck">
      <button
        type="button"
        className="deck-setup-topdeck-btn"
        onClick={onTopDeckToggle}
        aria-expanded={topDeckOpen}
        aria-haspopup="menu"
      >
        Top Deck
      </button>
      {topDeckOpen && (
        <div className="deck-setup-topdeck-menu" role="menu">
          {topDeckStatus === "loading" ? (
            <div className="deck-setup-topdeck-empty">Loading top decks...</div>
          ) : topDeckStatus === "error" ? (
            <div className="deck-setup-topdeck-empty">Unable to load top decks.</div>
          ) : topDecks.length === 0 ? (
            <div className="deck-setup-topdeck-empty">No top decks available.</div>
          ) : (
            topDecks.map((deck, index) => (
              <button
                key={deck.id}
                type="button"
                className="deck-setup-topdeck-item"
                onClick={() => onTopDeckSelect(deck)}
                role="menuitem"
              >
                <span>{getDeckLabel(deck, index)}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
