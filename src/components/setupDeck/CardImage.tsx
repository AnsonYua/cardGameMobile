import { buildApiImageUrl, getCardPreviewPath } from "./utils";

type Props = {
  apiBaseUrl: string;
  setId: string;
  cardId: string;
  alt: string;
  badgeText?: string | null;
};

export function CardImage({ apiBaseUrl, setId, cardId, alt, badgeText = null }: Props) {
  const previewPath = getCardPreviewPath(setId, cardId);
  const imgSrc = buildApiImageUrl(apiBaseUrl, previewPath);
  const fallbackSrc = buildApiImageUrl(apiBaseUrl, "previews/cardback.png");

  return (
    <div className="deck-card-imagewrap">
      <img
        className="deck-card-image"
        src={imgSrc}
        alt={alt}
        loading="lazy"
        decoding="async"
        onError={(e) => {
          const img = e.currentTarget;
          if (img.dataset.fallbackApplied === "1") return;
          img.dataset.fallbackApplied = "1";
          img.src = fallbackSrc;
        }}
      />
      {badgeText ? <span className="deck-card-badge">{badgeText}</span> : null}
    </div>
  );
}

