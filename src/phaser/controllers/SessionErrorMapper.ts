import { GameMode } from "../game/GameSessionService";
import type { ParsedSessionParams } from "../game/SessionParams";

export type SessionInitDialogAction = {
  label: string;
  href?: string;
  reload?: boolean;
  createRoom?: boolean;
};

export type SessionInitErrorSpec = {
  headerText: string;
  message: string;
  actions: SessionInitDialogAction[];
  allowOfflineFallback: boolean;
};

type SessionErrorCode =
  | "SESSION_MISSING"
  | "SESSION_EXPIRED"
  | "SESSION_MISMATCH"
  | "JOIN_TOKEN_REQUIRED"
  | "JOIN_TOKEN_INVALID"
  | "JOIN_TOKEN_EXPIRED"
  | "ROOM_FULL"
  | "MATCH_ALREADY_STARTED"
  | "ROOM_NOT_FOUND"
  | "SEAT_SWITCH_DISABLED"
  | "INTERNAL_ERROR";

const GO_LOBBY_ACTION: SessionInitDialogAction = { label: "Go Lobby", href: "/lobby" };
const CREATE_ROOM_ACTION: SessionInitDialogAction = { label: "Create New Room", createRoom: true };

function buildSpec(
  headerText: string,
  message: string,
  actions: SessionInitDialogAction[],
  allowOfflineFallback = false,
): SessionInitErrorSpec {
  return { headerText, message, actions, allowOfflineFallback };
}

function toStatus(err: any): number | undefined {
  const value = err?.status;
  return Number.isFinite(value) ? Number(value) : undefined;
}

function toMessage(err: any): string {
  const text = (err?.message ?? "").toString().trim();
  return text || "Request failed.";
}

function toErrorCode(err: any): SessionErrorCode | null {
  const fromData = (err?.data?.errorCode ?? err?.errorCode ?? "").toString().trim().toUpperCase();
  if (!fromData) return null;
  return fromData as SessionErrorCode;
}

function inferCodeFromLegacyError(err: any, parsed: ParsedSessionParams): SessionErrorCode | null {
  const message = toMessage(err).toLowerCase();
  const status = toStatus(err);

  if (message.includes("game is full")) return "ROOM_FULL";
  if (message.includes("room is not available for joining")) return "MATCH_ALREADY_STARTED";
  if (message.includes("invalid or expired session token")) return "SESSION_EXPIRED";
  if (message.includes("missing session token")) return "SESSION_MISSING";
  if (message.includes("session token does not match")) return "SESSION_MISMATCH";
  if (message.includes("game not found")) return "ROOM_NOT_FOUND";

  if (status === 404 && parsed.mode === GameMode.Join) return "ROOM_NOT_FOUND";
  return null;
}

function isNetworkLikeError(err: any): boolean {
  const status = toStatus(err);
  if (typeof status === "number" && status >= 500) return true;
  const message = toMessage(err).toLowerCase();
  if (message.includes("failed to fetch")) return true;
  if (message.includes("networkerror")) return true;
  if (message.includes("load failed")) return true;
  if (message.includes("network request failed")) return true;
  if (err?.name === "TypeError" && !status) return true;
  return false;
}

function byCode(code: SessionErrorCode): SessionInitErrorSpec {
  switch (code) {
    case "SESSION_MISSING":
    case "SESSION_EXPIRED":
    case "SESSION_MISMATCH":
      return buildSpec("Can't Reconnect Session", "Your saved game session is no longer valid on this browser.", [
        GO_LOBBY_ACTION,
        CREATE_ROOM_ACTION,
      ]);
    case "JOIN_TOKEN_REQUIRED":
    case "JOIN_TOKEN_INVALID":
    case "JOIN_TOKEN_EXPIRED":
      return buildSpec("Invalid Invite Link", "This join link is missing or has an invalid invite token.", [GO_LOBBY_ACTION]);
    case "ROOM_FULL":
      return buildSpec("Room Already Full", "Two players are already in this room.", [GO_LOBBY_ACTION]);
    case "MATCH_ALREADY_STARTED":
      return buildSpec("Match Already Started", "This room is locked because the match is already in progress.", [GO_LOBBY_ACTION]);
    case "SEAT_SWITCH_DISABLED":
      return buildSpec("Seat Switch Blocked", "Seat override links are disabled for normal games.", [GO_LOBBY_ACTION]);
    case "ROOM_NOT_FOUND":
      return buildSpec("Room Not Found", "This room no longer exists or has expired.", [GO_LOBBY_ACTION]);
    case "INTERNAL_ERROR":
    default:
      return buildSpec("Connection Problem", "Couldn't reach the game server.", [
        { label: "Retry", reload: true },
        GO_LOBBY_ACTION,
      ], true);
  }
}

export function mapSessionInitError(err: any, parsed: ParsedSessionParams): SessionInitErrorSpec {
  const code = toErrorCode(err) || inferCodeFromLegacyError(err, parsed);
  if (code) {
    return byCode(code);
  }

  if (isNetworkLikeError(err)) {
    return byCode("INTERNAL_ERROR");
  }

  const status = toStatus(err);
  if (typeof status === "number" && status >= 400 && status < 500) {
    return buildSpec("Session Error", toMessage(err), [GO_LOBBY_ACTION, CREATE_ROOM_ACTION]);
  }

  return byCode("INTERNAL_ERROR");
}
