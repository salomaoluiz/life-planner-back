import { ApiClient } from './client';
import { missingCount } from './diff';
import { Rng } from './random';

const UNITS = ['unit', 'gram', 'kilogram', 'liter', 'milliliter'] as const;
const DAY_MS = 86_400_000;

export interface StockRefs {
  familyIds: string[];
  personal: string;
}

export interface StockPayload {
  brand: string;
  description: string;
  expirationDate: null | string;
  notes: null | string;
  owner: 'FAMILY' | 'USER';
  ownerId: string;
  purchaseDate: string;
  quantity: number;
  unit: (typeof UNITS)[number];
}

function isoDayOffset(today: string, days: number): string {
  return new Date(Date.parse(`${today}T00:00:00Z`) + days * DAY_MS).toISOString();
}

function expirationFor(index: number, today: string): null | string {
  const slot = index % 20;
  if (slot === 0) return isoDayOffset(today, -1 - (index % 30));
  if (slot === 1) return isoDayOffset(today, index % 7);
  if (slot <= 4) return null;

  return isoDayOffset(today, 10 + ((index * 7) % 400));
}

export function buildStockItems(
  count: number,
  refs: StockRefs,
  today: string,
  rng: Rng,
): StockPayload[] {
  return Array.from({ length: count }, (_, index) => {
    const inFamily = index % 3 === 2 && refs.familyIds.length > 0;

    return {
      brand: rng.faker.company.name().slice(0, 100),
      description: `Perf item ${String(index).padStart(4, '0')}`,
      expirationDate: expirationFor(index, today),
      notes: index % 10 === 0 ? rng.faker.lorem.sentence() : null,
      owner: inFamily ? 'FAMILY' : 'USER',
      ownerId: inFamily ? refs.familyIds[index % refs.familyIds.length] : refs.personal,
      purchaseDate: isoDayOffset(today, -(index % 90)),
      quantity: 1 + (index % 20),
      unit: UNITS[index % UNITS.length],
    };
  });
}

export async function seedStock(
  client: ApiClient,
  cfg: { items: number },
  refs: StockRefs,
  today: string,
  rng: Rng,
): Promise<number> {
  const existing = (await client.get<{ description: string }[]>('/api/v1/stock/items')).filter(
    (item) => item.description.startsWith('Perf item '),
  ).length;
  const missing = missingCount(existing, cfg.items);
  // Same indexes as a full build, so a partial earlier run is completed with the same payloads.
  const payloads = buildStockItems(cfg.items, refs, today, rng).slice(existing);

  for (const payload of payloads.slice(0, missing)) {
    await client.post('/api/v1/stock/items', payload);
  }

  return missing;
}
