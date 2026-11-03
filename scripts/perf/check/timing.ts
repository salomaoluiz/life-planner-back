import { p50 } from './stats';

export interface TimingArgs {
  baseUrl: string;
  fetchFn?: typeof fetch;
  key: string;
  now?: () => number;
  path: string;
  runs?: number;
  token: string;
  warmups?: number;
}

export interface ConcurrentArgs {
  baseUrl: string;
  calls: { path: string }[];
  fetchFn?: typeof fetch;
  now?: () => number;
  repeat: number;
  token: string;
}

const headers = (token: string) => ({
  'Accept-Encoding': 'identity',
  Authorization: `Bearer ${token}`,
});

// maxPoolWaiting comes from the x-perf-pool-max-waiting header the API sets when PERF_COUNT_QUERIES=1 (spec 069).
export async function measureConcurrent(
  args: ConcurrentArgs,
): Promise<{ maxPoolWaiting?: number; wallMs: number }> {
  const fetchFn = args.fetchFn ?? fetch;
  const now = args.now ?? (() => performance.now());
  // One call before the clock starts resets the server-side max, so the scenario is measured alone.
  const first = args.calls[0].path;
  const reset = await fetchFn(`${args.baseUrl}${first}`, {
    headers: { ...headers(args.token), 'x-perf-reset-pool': '1' },
  });
  await reset.arrayBuffer();
  let maxPoolWaiting: number | undefined;
  const start = now();
  const requests = Array.from({ length: args.repeat }, () => args.calls).flat();
  await Promise.all(
    requests.map(async ({ path }) => {
      const response = await fetchFn(`${args.baseUrl}${path}`, { headers: headers(args.token) });
      if (!response.ok) throw new Error(`GET ${path} -> ${response.status}`);
      await response.arrayBuffer();
      const header = response.headers?.get('x-perf-pool-max-waiting');
      if (header != null) maxPoolWaiting = Math.max(maxPoolWaiting ?? 0, Number(header));
    }),
  );

  return { maxPoolWaiting, wallMs: now() - start };
}

// Errors name the key and the status only: bodies can carry personal data.
export async function measureRoute(args: TimingArgs): Promise<{ bytes: number; p50: number }> {
  const fetchFn = args.fetchFn ?? fetch;
  const now = args.now ?? (() => performance.now());
  const durations: number[] = [];
  let bytes = 0;
  for (let i = 0; i < (args.warmups ?? 2) + (args.runs ?? 7); i += 1) {
    const start = now();
    const response = await fetchFn(`${args.baseUrl}${args.path}`, {
      headers: headers(args.token),
    });
    if (!response.ok) throw new Error(`${args.key} -> ${response.status}`);
    bytes = (await response.arrayBuffer()).byteLength;
    if (i >= (args.warmups ?? 2)) durations.push(now() - start);
  }

  return { bytes, p50: p50(durations) };
}
