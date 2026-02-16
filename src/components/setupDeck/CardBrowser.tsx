import type { CardListItem } from "./types";
import { buildApiImageUrl, getCardPreviewPath } from "./utils";

type Props = {
  apiBaseUrl: string;
  selectedSet: string;
  status: "idle" | "loading" | "error";
  errorMessage: string | null;
  allCards: CardListItem[];
  filteredCards: CardListItem[];
  selectedCardId: string | null;
  deckQtyById: Map<string, number>;
  onSelectCard: (id: string) => void;
  onAddToDeck: (card: { id: string; name?: string }) => void;
};

export function CardBrowser({
  apiBaseUrl,
  selectedSet,
  status,
  errorMessage,
  allCards,
  filteredCards,
  selectedCardId,
  deckQtyById,
  onSelectCard,
  onAddToDeck,
}: Props) {
  return (
    <section className="deck-setup-cards deck-setup-cardswide">
      <div className="deck-setup-panel-header">
        <h2>Cards</h2>
        <span className="deck-setup-panel-meta">
          {status === "loading" ? "Loading..." : `${filteredCards.length} shown / ${allCards.length} total`}
        </span>
      </div>

      {status === "error" ? (
        <div className="deck-setup-empty">
          <p>Unable to load cards for `{selectedSet}`.</p>
          <span>{errorMessage}</span>
        </div>
      ) : filteredCards.length === 0 && status !== "loading" ? (
        <div className="deck-setup-empty">
          <p>No cards match your search.</p>
          <span>Try clearing the search box.</span>
        </div>
      ) : (
        <div className="deck-setup-cardlist" aria-busy={status === "loading"}>
          {filteredCards.map((card) => {
            const qty = deckQtyById.get(card.id) || 0;
            const previewPath = getCardPreviewPath(selectedSet, card.id);
            const imgSrc = buildApiImageUrl(apiBaseUrl, previewPath);
            const fallbackSrc = buildApiImageUrl(apiBaseUrl, "previews/cardback.png");
            return (
              <button
                key={card.id}
                type="button"
                className={`deck-card ${selectedCardId === card.id ? "is-selected" : ""}`}
                onClick={() => onSelectCard(card.id)}
              >
                <div className="deck-card-imagewrap">
                  <img
                    className="deck-card-image"
                    src={imgSrc}
                    alt={card.name || card.id}
                    loading="lazy"
                    decoding="async"
                    onError={(e) => {
                      const img = e.currentTarget;
                      if (img.dataset.fallbackApplied === "1") return;
                      img.dataset.fallbackApplied = "1";
                      img.src = fallbackSrc;
                    }}
                  />
                  {qty > 0 && <span className="deck-card-badge">x{qty}</span>}
                </div>
                <div className="deck-card-footer">
                  <span
                    className="deck-card-add"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onAddToDeck({ id: card.id, name: typeof card.name === "string" ? card.name : undefined });
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    +
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
