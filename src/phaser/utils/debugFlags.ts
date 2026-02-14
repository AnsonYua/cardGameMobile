export function isDebugFlagEnabled(flag: string): boolean {
  //return true
  if (!flag) return false;
  if (typeof window === "undefined") return false;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get(flag) === "1" || params.get(flag) === "true") return true;
  } catch {
    // ignore
  }
  try {
    return window.localStorage?.getItem(flag) === "1";
  } catch {
    return false;
  }
}

