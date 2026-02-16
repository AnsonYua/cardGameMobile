import { readDeckFromStorage } from "./deckStorage";

type SubmitDeckFromStorageParams<TResponse = any> = {
  gameId: string;
  playerId: string;
  source: string;
  emptyDeckMessage: string;
  submit: (deck: Array<{ id: string; qty: number; setId?: string; name?: string }>) => Promise<TResponse>;
};

export async function submitDeckFromStorage<TResponse = any>(
  params: SubmitDeckFromStorageParams<TResponse>,
): Promise<{ deckCount: number; response: TResponse }> {
  const deck = readDeckFromStorage();
  if (deck.length === 0) {
    throw new Error(params.emptyDeckMessage);
  }

  console.log(`[deck-submit] ${params.source}`, {
    gameId: params.gameId,
    playerId: params.playerId,
    deckCount: deck.length,
  });
  const response = await params.submit(deck);
  return { deckCount: deck.length, response };
}
