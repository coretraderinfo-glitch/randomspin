export function normalizeExcludedNumbers(value: unknown): number[] {
  const parsedValue = typeof value === "string" ? parseExcludedNumbersJson(value) : value;

  if (!Array.isArray(parsedValue)) {
    return [];
  }

  return Array.from(new Set(parsedValue.filter((item): item is number => Number.isInteger(item)))).sort((a, b) => a - b);
}

export function serializeExcludedNumbers<T = number[] | string>(numbers: number[]): T {
  if (process.env.SQLITE_DATABASE_URL && !process.env.DATABASE_URL) {
    return JSON.stringify(numbers) as T;
  }

  return numbers as T;
}

function parseExcludedNumbersJson(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return [];
  }
}
