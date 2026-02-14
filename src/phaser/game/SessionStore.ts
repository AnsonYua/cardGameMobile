export type SessionState = {
  gameId: string | null;
  playerId: string | null;
  joinToken: string | null;
  sessionToken: string | null;
  sessionExpiresAt: number | null;
};

const sessionState: SessionState = {
  gameId: null,
  playerId: null,
  joinToken: null,
  sessionToken: null,
  sessionExpiresAt: null,
};

export function getSession(): SessionState {
  return { ...sessionState };
}

export function updateSession(partial: Partial<SessionState>): SessionState {
  for (const [key, value] of Object.entries(partial)) {
    if (value !== undefined) {
      (sessionState as any)[key] = value;
    }
  }
  return getSession();
}

export function clearSession(): SessionState {
  sessionState.gameId = null;
  sessionState.playerId = null;
  sessionState.joinToken = null;
  sessionState.sessionToken = null;
  sessionState.sessionExpiresAt = null;
  return getSession();
}

export function getSessionToken() {
  return sessionState.sessionToken;
}

export function setSessionToken(token: string | null) {
  sessionState.sessionToken = token;
  return getSession();
}
