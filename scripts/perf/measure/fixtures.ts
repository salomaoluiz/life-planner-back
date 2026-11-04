import type { ApiClient } from '../seed/client';
import type { SeedManifest } from '../seed/manifest';

export type FixtureName =
  | 'account'
  | 'card'
  | 'category'
  | 'family'
  | 'plan'
  | 'recurrence'
  | 'stockItem'
  | 'tag'
  | 'transaction';
export type Fixtures = { referenceMonth: string; userId: string } & Record<
  FixtureName,
  string | undefined
>;

const FINANCE = '/api/v1/finance';
const PLAN_LOOKBACK_MONTHS = 12;

function shiftMonth(month: string, delta: number): string {
  const [year, number] = month.split('-').map(Number);

  return new Date(Date.UTC(year, number - 1 + delta, 1)).toISOString().slice(0, 7);
}

export function expandPath(template: string, params: Record<string, string>, fx: Fixtures): string {
  return template.replace(/:(\w+)/g, (_match, name: string) => {
    const fixture = params[name];
    const value =
      fixture === undefined ? undefined : (fx as Record<string, string | undefined>)[fixture];
    if (value === undefined) throw new Error(`fixture "${fixture ?? name}" missing`);

    return value;
  });
}

export function expandScenario(scenario: string, fx: Fixtures): string {
  const [year, month] = fx.referenceMonth.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const next = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 7);
  const tokens: Record<string, string> = {
    familyId: fx.family ?? '',
    monthEnd: `${fx.referenceMonth}-${String(lastDay).padStart(2, '0')}`,
    monthStart: `${fx.referenceMonth}-01`,
    nextMonth: next,
    referenceMonth: fx.referenceMonth,
    userId: fx.userId,
  };

  return scenario.replace(/\{(\w+)\}/g, (match, name: string) => tokens[name] ?? match);
}

// First element of each list endpoint of the perf account; the plan comes from the first installment row of the month.
export async function resolveFixtures(
  client: Pick<ApiClient, 'get'>,
  manifest: Pick<SeedManifest, 'referenceMonth' | 'userId'>,
): Promise<Fixtures> {
  const first = async (path: string): Promise<string | undefined> =>
    (await client.get<{ id: string }[]>(path))[0]?.id;
  const base = { referenceMonth: manifest.referenceMonth, userId: manifest.userId };
  // The pinned dataset (spec 093) does not guarantee an installment row in the reference month: look back a year.
  let plan: string | undefined;
  for (let back = 0; back <= PLAN_LOOKBACK_MONTHS && !plan; back += 1) {
    const month = expandScenario('from={monthStart}&to={monthEnd}', {
      ...base,
      referenceMonth: shiftMonth(base.referenceMonth, -back),
    } as Fixtures);
    const { items: rows } = await client.get<{
      items: { installmentPlanId: null | string }[];
    }>(`${FINANCE}/transactions?source=CARD&${month}`);
    plan = rows.find((row) => row.installmentPlanId)?.installmentPlanId ?? undefined;
  }

  // Spec 077: one account row of the reference month, for `GET /transactions/:id`.
  const { items: monthRows } = await client.get<{ items: { id: string }[] }>(
    `${FINANCE}/transactions?limit=1&${expandScenario('from={monthStart}&to={monthEnd}', base as Fixtures)}`,
  );

  return {
    ...base,
    account: await first(`${FINANCE}/accounts`),
    card: await first(`${FINANCE}/credit-cards`),
    category: await first(`${FINANCE}/categories`),
    family: await first('/api/v1/families'),
    plan,
    recurrence: await first(`${FINANCE}/recurrences`),
    stockItem: await first('/api/v1/stock/items'),
    tag: await first(`${FINANCE}/tags`),
    transaction: monthRows[0]?.id,
  };
}
