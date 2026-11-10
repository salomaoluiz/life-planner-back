import { Client } from 'pg';

import { p50 } from './stats';

// Median round-trip of a trivial query after one warm-up: tells a slow database link from a slow route.
export async function measureRoundTrip(
  query: () => Promise<unknown>,
  runs = 7,
  now: () => number = () => performance.now(),
): Promise<number> {
  await query();
  const durations: number[] = [];
  for (let i = 0; i < runs; i += 1) {
    const start = now();
    await query();
    durations.push(now() - start);
  }

  return p50(durations);
}

// Never prints the connection settings: errors carry only the message of the driver.
export async function dbRoundTrip(): Promise<number> {
  const client = new Client({
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
  });
  await client.connect();
  try {
    return await measureRoundTrip(() => client.query('SELECT 1'));
  } finally {
    await client.end();
  }
}
