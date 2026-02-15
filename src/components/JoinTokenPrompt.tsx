export function requestJoinToken(promptText = "Enter join token for this game:"): string | null {
  if (typeof window === "undefined") return null;
  const value = window.prompt(promptText);
  const trimmed = value ? value.trim() : "";
  return trimmed ? trimmed : null;
}
