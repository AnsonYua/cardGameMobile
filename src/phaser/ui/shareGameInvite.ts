import { buildLobbyJoinUrl } from "./gameUrlBuilders";

export type ShareGameInviteConfig = {
  gameId?: string | null;
  joinToken?: string | null;
  joinUrlBase?: string;
  isAutoPolling?: boolean;
};

export function resolveShareGameInviteUrl(config: ShareGameInviteConfig): string | null {
  if (!config.gameId || !config.joinToken) return null;

  return buildLobbyJoinUrl({
    base: config.joinUrlBase,
    gameId: config.gameId,
    joinToken: config.joinToken,
    isAutoPolling: config.isAutoPolling ?? true,
  });
}
