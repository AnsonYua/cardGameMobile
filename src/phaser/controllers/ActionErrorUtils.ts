export function getUserFacingActionErrorMessage(err: any): string {
  const rawMessage = (err?.message ?? "").toString();
  // ApiManager throws ApiError; use its message as the user-facing text.
  if (err?.name === "ApiError" && rawMessage) return rawMessage;
  // Fallback: try to pull `"error":"..."` from the serialized JSON embedded in the message.
  const match = rawMessage.match(/\"error\"\\s*:\\s*\"([^\"]+)\"/);
  if (match?.[1]) return match[1];
  return rawMessage || "Request failed.";
}

export function showActionError(
  errorDialog: import("../ui/ErrorDialog").ErrorDialog | null | undefined,
  err: any,
  opts: { headerText?: string } = {},
) {
  const msg = getUserFacingActionErrorMessage(err);
  errorDialog?.show({ headerText: opts.headerText ?? "Action Failed", message: msg });
}
