export type TargetTotals = {
  totalAP: number;
  totalHP: number;
};

export function resolveTargetTotals(target: any): TargetTotals {
  const ap =
    target?.computed?.totalAP ??
    target?.computed?.ap ??
    target?.fieldCardValue?.totalAP ??
    target?.cardData?.ap ??
    target?.ap ??
    0;
  const hp =
    target?.computed?.totalHP ??
    target?.computed?.hp ??
    target?.fieldCardValue?.totalHP ??
    target?.cardData?.hp ??
    target?.hp ??
    0;
  return {
    totalAP: Number(ap) || 0,
    totalHP: Number(hp) || 0,
  };
}

