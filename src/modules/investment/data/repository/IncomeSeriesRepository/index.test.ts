import { Test } from '@nestjs/testing';

import { incomeSeriesFixture } from '@investment/domain/entity/mocks/income.fixture';

import { IncomeSeriesRepository } from './index';

const row = {
  account_id: 'acc-1',
  amount_per_unit: { toFixed: () => '1.10000000' },
  asset_id: 'asset-1',
  category_id: 'cat-1',
  created_by: 'user-1',
  currency: 'BRL',
  end_date: null,
  end_reason: null,
  ended_at: null,
  ex_date_offset_days: 8,
  first_number: 1,
  first_payment_date: new Date('2025-01-15T00:00:00Z'),
  frequency_interval: 1,
  frequency_unit: 'MONTH',
  id: 'series-1',
  last_generated_number: 23,
  notes: null,
  type: 'YIELD',
  with_finance: true,
};
const datasource = {
  countOccurrences: jest.fn(),
  createSeries: jest.fn(),
  deleteSeries: jest.fn(),
  endSeries: jest.fn(),
  findActiveByOwners: jest.fn(),
  findAllActive: jest.fn(),
  findByAsset: jest.fn(),
  findById: jest.fn(),
  findPlannedFrom: jest.fn(),
  materialize: jest.fn(),
  splitSeries: jest.fn(),
  updateSeries: jest.fn(),
};
let setup: IncomeSeriesRepository;

beforeEach(async () => {
  jest.resetAllMocks();

  const module = await Test.createTestingModule({
    providers: [
      IncomeSeriesRepository,
      { provide: 'IIncomeSeriesDatasource', useValue: datasource },
    ],
  }).compile();

  setup = module.get(IncomeSeriesRepository);
});

it('SHOULD map the rows to entities', async () => {
  datasource.findByAsset.mockResolvedValue([row]);
  datasource.findAllActive.mockResolvedValue([row]);
  datasource.findActiveByOwners.mockResolvedValue([row]);
  datasource.findById.mockResolvedValueOnce(row).mockResolvedValueOnce(null);

  expect((await setup.findByAsset('asset-1'))[0]).toMatchObject({
    amountPerUnit: '1.1',
    id: 'series-1',
  });
  expect(await setup.findAllActive()).toHaveLength(1);
  expect(await setup.findActiveByOwners([])).toHaveLength(1);
  expect((await setup.findById('series-1'))?.firstPaymentDate).toBe('2025-01-15');
  expect(await setup.findById('x')).toBeUndefined();
});

it('SHOULD pass the writes and the other reads straight to the datasource', async () => {
  const params = { assetLabel: 'HGLG11', occurrences: [], series: incomeSeriesFixture() };

  datasource.createSeries.mockResolvedValue('series-1');
  datasource.splitSeries.mockResolvedValue('series-2');
  datasource.countOccurrences.mockResolvedValue({ planned: 1, received: 2 });
  datasource.findPlannedFrom.mockResolvedValue([{ id: 'a' }]);

  expect(await setup.createSeries(params)).toBe('series-1');
  expect(await setup.countOccurrences('series-1')).toEqual({ planned: 1, received: 2 });
  expect(await setup.findPlannedFrom('series-1', 3)).toEqual([{ id: 'a' }]);
  expect(
    await setup.splitSeries({
      create: params,
      deleteFromNumber: 3,
      endedAt: '2026-11-15',
      id: 'series-1',
    }),
  ).toBe('series-2');

  await setup.deleteSeries('series-1');
  await setup.endSeries({ endedAt: '2026-11-15', endReason: 'MANUAL' as never, id: 'series-1' });
  await setup.materialize({
    assetLabel: 'x',
    lastGeneratedNumber: 1,
    occurrences: [],
    seriesId: 's',
  });
  await setup.updateSeries({ assetLabel: 'x', patch: {}, seriesId: 's' });

  expect(datasource.deleteSeries).toHaveBeenCalledWith('series-1');
  expect(datasource.endSeries).toHaveBeenCalledTimes(1);
  expect(datasource.materialize).toHaveBeenCalledTimes(1);
  expect(datasource.updateSeries).toHaveBeenCalledTimes(1);
});
