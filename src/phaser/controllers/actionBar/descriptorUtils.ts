import type { ActionDescriptor } from "../../game/ActionRegistry";

export function mergeActionDescriptors(...lists: Array<ActionDescriptor[] | undefined | null>): ActionDescriptor[] {
  const out: ActionDescriptor[] = [];
  const seen = new Set<string>();
  for (const list of lists) {
    if (!list?.length) continue;
    for (const d of list) {
      if (!d?.id) continue;
      if (seen.has(d.id)) continue;
      seen.add(d.id);
      out.push(d);
    }
  }
  return out;
}

export function sortActionDescriptors(descriptors: ActionDescriptor[]) {
  const rank = (id: string) => {
    if (id === "attackUnit") return 10;
    if (id === "attackShieldArea") return 11;
    if (id === "activateEffect") return 20;
    if (id === "playCard" || id.startsWith("play")) return 30;
    if (id === "endTurn") return 90;
    if (id === "cancelSelection") return 99;
    return 50;
  };
  return [...descriptors].sort((a, b) => rank(a.id) - rank(b.id));
}

export function normalizePrimary(descriptors: ActionDescriptor[]) {
  let primarySet = false;
  return descriptors.map((d) => {
    if (!d.primary) return d;
    if (!primarySet) {
      primarySet = true;
      return d;
    }
    return { ...d, primary: false };
  });
}
