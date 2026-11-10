import 'dotenv/config';
import axios from 'axios';
import { Client } from 'pg';

import { BrapiQuotes } from '@shared/infra/quotes/brapi';

import { BackfillOptions, parseArgs } from './args';
import { brapiRangeFor, DailyClose, largestAllowedRange, selectRows, withRetry } from './plan';

// Spec 104 FR 15: one-off historical load of daily closes (B3 symbols and, with --fx, USD-BRL). Runs on demand only;
// idempotent (upserts by (market, ticker, date) / (pair, date)). Exit 0 = done, 1 = some failed, 2 = could not run.
const AWESOME_DAILY = 'https://economia.awesomeapi.com.br/json/daily/USD-BRL';
const PAIR = 'USD-BRL';

interface Summary {
  failures: string[];
  inserted: number;
  tickers: number;
  updated: number;
}

function isRetryable(error: unknown): boolean {
  const status = (error as { response?: { status?: number } })?.response?.status;

  return status === 429 || (status !== undefined && status >= 500) || status === undefined;
}
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function defaultTickers(db: Client): Promise<{ from: string; ticker: string }[]> {
  const { rows } = await db.query<{ from: string; ticker: string }>(`
    SELECT a.ticker AS ticker,
           COALESCE(to_char(MIN(o.date), 'YYYY-MM-DD'), to_char(CURRENT_DATE - 90, 'YYYY-MM-DD')) AS "from"
    FROM investment_assets a
    LEFT JOIN investment_operations o ON o.asset_id = a.id
    WHERE a.asset_class IN ('BR_STOCK', 'BR_REIT') AND a.ticker IS NOT NULL
      AND (
        (a.status = 'ACTIVE' AND COALESCE((
          SELECT SUM(CASE WHEN x.type = 'BUY' THEN x.quantity ELSE -x.quantity END)
          FROM investment_operations x WHERE x.asset_id = a.id), 0) > 0)
        OR EXISTS (SELECT 1 FROM investment_operations x WHERE x.asset_id = a.id)
      )
    GROUP BY a.ticker
    ORDER BY a.ticker
  `);

  return rows;
}

async function loadBrapi(
  brapi: BrapiQuotes,
  ticker: string,
  from: string,
  today: string,
): Promise<DailyClose[]> {
  const options = { attempts: 3, baseMs: 1000, isRetryable, sleep };
  let range = brapiRangeFor(from, today);

  try {
    return await withRetry(() => brapi.getDailyHistory(ticker, range), options);
  } catch (error) {
    const message = (error as { response?: { data?: { code?: string; message?: string } } })
      ?.response?.data;
    const fallback =
      message?.code === 'INVALID_RANGE' ? largestAllowedRange(message.message ?? '') : null;

    if (!fallback || fallback === range) {
      throw error;
    }

    range = fallback;
    console.log(`  ${ticker}: the plan does not allow that range, using ${range}`);

    return withRetry(() => brapi.getDailyHistory(ticker, range), options);
  }
}

async function upsert(db: Client, sql: string, params: unknown[]): Promise<boolean> {
  const { rows } = await db.query<{ inserted: boolean }>(sql, params);

  return rows[0]?.inserted === true;
}

async function backfillTicker(
  db: Client,
  brapi: BrapiQuotes,
  ticker: string,
  from: string,
  options: BackfillOptions,
  summary: Summary,
  today: string,
): Promise<void> {
  const range = brapiRangeFor(from, today);

  if (options.dryRun) {
    const { rows } = await db.query<{ count: string }>(
      `SELECT count(*) FROM investment_price_history WHERE market = 'B3' AND ticker = $1 AND date BETWEEN $2 AND $3`,
      [ticker, from, options.to],
    );

    console.log(
      `  ${ticker}: ${from}..${options.to}, brapi range ${range}, 1 call, ${rows[0].count} day(s) already stored (would be updated)`,
    );

    return;
  }

  const closes = selectRows(await loadBrapi(brapi, ticker, from, today), from, options.to);

  for (const row of closes) {
    const inserted = await upsert(
      db,
      `INSERT INTO investment_price_history (id, market, ticker, date, close, source, created_at, updated_at)
       VALUES (gen_random_uuid()::text, 'B3', $1, $2, $3, 'BRAPI', now(), now())
       ON CONFLICT (market, ticker, date) DO UPDATE SET close = EXCLUDED.close, updated_at = now()
       RETURNING (xmax = 0) AS inserted`,
      [ticker, row.date, row.close],
    );

    summary[inserted ? 'inserted' : 'updated'] += 1;
  }

  console.log(`  ${ticker}: ${closes.length} day(s) loaded`);
}

async function backfillFx(
  db: Client,
  from: string,
  options: BackfillOptions,
  summary: Summary,
): Promise<void> {
  const start = from.replace(/-/g, '');
  const end = options.to.replace(/-/g, '');

  if (options.dryRun) {
    console.log(`  ${PAIR}: ${from}..${options.to}, AwesomeAPI daily history, 1 call`);

    return;
  }

  const { data } = await withRetry(
    () =>
      axios.get<{ bid: string; timestamp: string }[]>(`${AWESOME_DAILY}/360`, {
        params: { end_date: end, start_date: start },
        timeout: 15000,
      }),
    { attempts: 3, baseMs: 1000, isRetryable, sleep },
  );

  for (const row of data) {
    const date = new Date(Number(row.timestamp) * 1000).toLocaleDateString('en-CA', {
      timeZone: 'America/Sao_Paulo',
    });
    const inserted = await upsert(
      db,
      `INSERT INTO fx_rate_history (id, pair, date, rate, source)
       VALUES (gen_random_uuid()::text, $1, $2, $3, 'AWESOMEAPI')
       ON CONFLICT (pair, date) DO UPDATE SET rate = EXCLUDED.rate, source = EXCLUDED.source
       RETURNING (xmax = 0) AS inserted`,
      [PAIR, date, Number(row.bid).toFixed(6)],
    );

    summary[inserted ? 'inserted' : 'updated'] += 1;
  }

  console.log(`  ${PAIR}: ${data.length} day(s) loaded`);
}

async function main(): Promise<number> {
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.QUOTES_BACKFILL_ALLOW_PRODUCTION !== 'true'
  ) {
    console.error(
      'quotes backfill refused: NODE_ENV is production (set QUOTES_BACKFILL_ALLOW_PRODUCTION=true to run it there)',
    );

    return 2;
  }
  if (!process.env.BRAPI_TOKEN) {
    console.error('quotes backfill needs BRAPI_TOKEN in .env');

    return 2;
  }

  const today = new Date().toISOString().slice(0, 10);
  let options: BackfillOptions;

  try {
    options = parseArgs(process.argv.slice(2), today);
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'invalid options');

    return 2;
  }

  const db = new Client({
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
  });
  const brapi = new BrapiQuotes({ brapiToken: process.env.BRAPI_TOKEN } as never);
  const summary: Summary = { failures: [], inserted: 0, tickers: 0, updated: 0 };

  await db.connect();

  try {
    const found = await defaultTickers(db);
    const targets = options.tickers
      ? options.tickers.map((ticker) => ({
          from: options.from ?? found.find((row) => row.ticker === ticker)?.from ?? options.to,
          ticker,
        }))
      : found.map((row) => ({ from: options.from ?? row.from, ticker: row.ticker }));

    console.log(`${options.dryRun ? 'DRY RUN: ' : ''}${targets.length} B3 symbol(s)`);

    for (const target of targets) {
      try {
        await backfillTicker(db, brapi, target.ticker, target.from, options, summary, today);
        summary.tickers += 1;
      } catch (error) {
        summary.failures.push(target.ticker);
        console.error(
          `  ${target.ticker}: failed (${error instanceof Error ? error.message : 'error'})`,
        );
      }

      await sleep(options.delayMs);
    }

    if (options.fx) {
      const from =
        options.from ??
        targets.reduce((min, target) => (target.from < min ? target.from : min), options.to);

      try {
        await backfillFx(db, from, options, summary);
      } catch (error) {
        summary.failures.push(PAIR);
        console.error(`  ${PAIR}: failed (${error instanceof Error ? error.message : 'error'})`);
      }
    }
  } finally {
    await db.end();
  }

  console.log(
    `${options.dryRun ? 'DRY RUN ' : ''}done: ${summary.tickers} ticker(s), ${summary.inserted} inserted, ${summary.updated} updated, ${summary.failures.length} failure(s)${summary.failures.length > 0 ? ` (${summary.failures.join(', ')})` : ''}`,
  );

  return summary.failures.length > 0 ? 1 : 0;
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'quotes backfill failed');
    process.exit(2);
  });
