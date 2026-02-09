export function resolveCardUid(card: any): string | undefined {
  if (!card) return undefined;
  if (typeof card === "string") return card;
  return (
    card?.carduid ??
    card?.cardUid ??
    card?.uid ??
    card?.id ??
    card?.cardId ??
    undefined
  );
}
