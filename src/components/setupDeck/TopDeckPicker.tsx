import type { TopDeckItem } from "../../phaser/api/ApiManager";

type Props = {
  topDecks: TopDeckItem[];
  topDeckOpen: boolean;
  topDeckStatus: "idle" | "loading" | "error";
  onTopDeckToggle: () => void;
  onTopDeckSelect: (deck: TopDeckItem) => void;
};

export function TopDeckPicker({ topDecks, topDeckOpen, topDeckStatus, onTopDeckToggle, onTopDeckSelect }: Props) {
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
            topDecks.map((deck) => (
              <button
                key={deck.id}
                type="button"
                className="deck-setup-topdeck-item"
                onClick={() => onTopDeckSelect(deck)}
                role="menuitem"
              >
                <span>{deck.name}</span>
                <span>{deck.cardCount} cards</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
