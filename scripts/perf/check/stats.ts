const RATIO = 1.25;
const FLOOR_MS = 15;
export const LIST_MAX_BYTES = 262144;

export function checkSize(args: {
  bytes: number;
  kind: 'list' | 'other';
  knownException?: string;
  maxBytes: number | null;
}): string | undefined {
  if (args.kind === 'list' && !args.knownException && args.bytes > LIST_MAX_BYTES) {
    return `list is ${args.bytes} bytes, over the ${LIST_MAX_BYTES} byte limit (add pagination or a knownException)`;
  }
  if (args.maxBytes !== null && args.bytes > args.maxBytes) {
    return `response is ${args.bytes} bytes, over maxBytes ${args.maxBytes}`;
  }

  return undefined;
}

export function isRegression(measured: number, baseline: number | null): boolean {
  if (baseline === null) return false;

  return measured > baseline * RATIO && measured - baseline > FLOOR_MS;
}

export function p50(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);

  return sorted[Math.ceil(sorted.length / 2) - 1];
}
