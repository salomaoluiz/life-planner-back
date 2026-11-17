import { Test } from '@nestjs/testing';

import { Prisma } from '@db/client';

import { MarketIndexRepository } from './index';

const names = [
  'findFetches',
  'findFollowers',
  'findFxPairs',
  'findIndexedAssetIds',
  'findLatest',
  'findLatestBefore',
  'findLatestDates',
  'findValues',
  'recalculateAsset',
  'recordFetch',
  'upsertValues',
  'versionStamp',
] as const;

export const spies = Object.fromEntries(names.map((name) => [name, jest.fn()])) as Record<
  (typeof names)[number],
  jest.Mock
>;

export const mocks = {
  decimal: (value: string) => new Prisma.Decimal(value),
};

export async function setup(): Promise<MarketIndexRepository> {
  const module = await Test.createTestingModule({
    providers: [MarketIndexRepository, { provide: 'IMarketIndexDatasource', useValue: spies }],
  }).compile();

  return module.get(MarketIndexRepository);
}
