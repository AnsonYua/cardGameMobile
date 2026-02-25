export type ComparisonOperator = "<" | "<=" | ">" | ">=" | "==" | "!=";

type ParsedComparison = {
  operator: ComparisonOperator;
  value: number;
};

const COMPARISON_REGEX = /^\s*(<=|>=|==|!=|=|<|>)\s*(-?\d+)\s*$/;
const DYNAMIC_TOKEN_REGEX = /^\s*(<=|>=|==|!=|=|<|>)\s*([A-Za-z_][A-Za-z0-9_]*)\s*$/;

export function evaluateComparison(target: number, operator: ComparisonOperator, value: number): boolean {
  switch (operator) {
    case "<":
      return target < value;
    case "<=":
      return target <= value;
    case ">":
      return target > value;
    case ">=":
      return target >= value;
    case "==":
      return target === value;
    case "!=":
      return target !== value;
    default:
      return false;
  }
}

export function parseComparisonFilter(filter: string): ParsedComparison | null {
  if (typeof filter !== "string") return null;
  const match = filter.match(COMPARISON_REGEX);
  if (!match) return null;

  const operator = normalizeOperator(match[1]);
  const value = Number(match[2]);
  if (!operator || !Number.isFinite(value)) return null;
  return { operator, value };
}

export function parseDynamicComparisonFilter(
  filter: string,
  dynamicValues: Record<string, number>,
): ParsedComparison | null {
  if (typeof filter !== "string") return null;
  const match = filter.match(DYNAMIC_TOKEN_REGEX);
  if (!match) return null;

  const operator = normalizeOperator(match[1]);
  if (!operator) return null;

  const token = normalizeToken(match[2]);
  const value = resolveDynamicTokenValue(token, dynamicValues);
  if (!Number.isFinite(value)) return null;

  return { operator, value };
}

export function evaluateComparisonFilter(
  target: number,
  filter: string,
  dynamicValues?: Record<string, number>,
): boolean {
  if (!Number.isFinite(target)) return false;

  const staticFilter = parseComparisonFilter(filter);
  if (staticFilter) {
    return evaluateComparison(target, staticFilter.operator, staticFilter.value);
  }

  if (!dynamicValues || typeof dynamicValues !== "object") {
    return false;
  }

  const dynamicFilter = parseDynamicComparisonFilter(filter, dynamicValues);
  if (!dynamicFilter) {
    return false;
  }

  return evaluateComparison(target, dynamicFilter.operator, dynamicFilter.value);
}

function normalizeOperator(raw: string): ComparisonOperator | null {
  if (raw === "=") return "==";
  if (raw === "<" || raw === "<=" || raw === ">" || raw === ">=" || raw === "==" || raw === "!=") {
    return raw;
  }
  return null;
}

function normalizeToken(raw: string): string {
  return raw.replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase();
}

function resolveDynamicTokenValue(token: string, dynamicValues: Record<string, number>): number {
  if (Object.prototype.hasOwnProperty.call(dynamicValues, token)) {
    return Number(dynamicValues[token]);
  }
  const camelLike = token
    .toLowerCase()
    .replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
  if (Object.prototype.hasOwnProperty.call(dynamicValues, camelLike)) {
    return Number(dynamicValues[camelLike]);
  }
  return Number.NaN;
}
