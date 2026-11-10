// Pure helpers of the historical load (spec 104 FR 15).
export interface DailyClose {
  close: string;
  date: string;
}

// brapi ranges from the shortest to the longest.
export const BRAPI_RANGES = ['1mo', '3mo', '6mo', '1y', '2y', '5y', '10y', 'max'] as const;
const RANGE_DAYS: Record<(typeof BRAPI_RANGES)[number], number> = {
  '10y': 3650,
  '1mo': 31,
  '1y': 366,
  '2y': 731,
  '3mo': 92,
  '5y': 1827,
  '6mo': 184,
  max: Infinity,
};

function daysBetween(from: string, to: string): number {
  return Math.round(
    (new Date(`${to}T00:00:00.000Z`).getTime() - new Date(`${from}T00:00:00.000Z`).getTime()) /
      86_400_000,
  );
}

// The shortest range that reaches back to `from`.
export function brapiRangeFor(from: string, today: string): string {
  const days = daysBetween(from, today);

  return BRAPI_RANGES.find((range) => RANGE_DAYS[range] >= days) ?? 'max';
}

// "Ranges permitidos: 1d, 5d, 1mo, 3mo" -> the longest of them we know; null when the message has none.
export function largestAllowedRange(message: string): null | string {
  const allowed = /permitidos:\s*([^.]*)/i
    .exec(message)?.[1]
    ?.split(',')
    .map((item) => item.trim());
  const known = BRAPI_RANGES.filter((range) => allowed?.includes(range));

  return known.length > 0 ? known[known.length - 1] : null;
}

export function selectRows(rows: DailyClose[], from: string, to: string): DailyClose[] {
  return rows.filter((row) => row.date >= from && row.date <= to);
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    attempts: number;
    baseMs: number;
    isRetryable: (error: unknown) => boolean;
    sleep: (ms: number) => Promise<void>;
  },
): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= options.attempts || !options.isRetryable(error)) {
        throw error;
      }

      await options.sleep(options.baseMs * 2 ** (attempt - 1));
    }
  }
}
