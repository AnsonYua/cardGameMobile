export function isAutomationEnabled(search = typeof window !== "undefined" ? window.location.search : ""): boolean {
  if (!search) return false;
  try {
    const params = new URLSearchParams(search);
    const value = params.get("automation");
    return value === "1" || value === "true";
  } catch {
    return false;
  }
}
