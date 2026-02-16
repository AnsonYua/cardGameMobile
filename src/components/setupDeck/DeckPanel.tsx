import type { DeckEntry } from "./types";
import { normalizeSetId } from "./utils";
import { CardImage } from "./CardImage";

type Props = {
  apiBaseUrl: string;
  deck: DeckEntry[];
  deckCount: number;
  onChangeDeck: (cardId: string, delta: number) => void;
};

const inferSetIdFromCardId = (cardId: string) => {
  const match = String(cardId).match(/^(ST|GD)(\d{2})-/i);
  if (!match) return null;
  return normalizeSetId(`${match[1]}${match[2]}`);
};

export function DeckPanel({ apiBaseUrl, deck, deckCount, onChangeDeck }: Props) {
  return (
    <section className="deck-setup-deck deck-setup-deckwide">
      <div className="deck-setup-panel-header">
        <h2>Deck</h2>
        <span className="deck-setup-panel-meta">{deckCount} cards</span>
      </div>

      {deck.length === 0 ? (
        <div className="deck-setup-empty">
          <p>Deck is empty.</p>
          <span>Click Add on cards to start building.</span>
        </div>
      ) : (
        <div className="deck-setup-deckgrid">
          {deck
            .slice()
            .sort((a, b) => a.id.localeCompare(b.id))
            .map((entry) => {
              const setId = entry.setId || inferSetIdFromCardId(entry.id) || "st01";
              return (
                <div key={entry.id} className="deck-card deck-card--deck">
                  <CardImage
                    apiBaseUrl={apiBaseUrl}
                    setId={setId}
                    cardId={entry.id}
                    alt={entry.name || entry.id}
                    badgeText={`x${entry.qty}`}
                  />
                  <div className="deck-card-footer deck-card-footer--deck">
                    <button
                      type="button"
                      className="deck-card-step"
                      onClick={() => onChangeDeck(entry.id, -1)}
                      aria-label="Remove one"
                    >
                      -
                    </button>
                    <button
                      type="button"
                      className="deck-card-step"
                      onClick={() => onChangeDeck(entry.id, 1)}
                      aria-label="Add one"
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </section>
  );
}
