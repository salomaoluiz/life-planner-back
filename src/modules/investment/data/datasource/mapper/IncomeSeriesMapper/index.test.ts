import { Prisma } from '@db/client';

import { IncomeSeriesMapper } from './index';

it('SHOULD map a series row with dates, enums AND the shortest decimal', () => {
  const series = IncomeSeriesMapper.toSeries({
    account_id: 'acc-1',
    amount_per_unit: new Prisma.Decimal('1.10000000'),
    asset_id: 'asset-1',
    category_id: 'cat-1',
    created_at: new Date(),
    created_by: 'user-1',
    currency: 'BRL',
    end_date: new Date('2027-01-31T00:00:00Z'),
    end_reason: 'MANUAL',
    ended_at: new Date('2026-11-15T00:00:00Z'),
    ex_date_offset_days: 8,
    first_number: 23,
    first_payment_date: new Date('2025-01-15T00:00:00Z'),
    frequency_interval: 2,
    frequency_unit: 'WEEK',
    id: 'series-1',
    last_generated_number: 30,
    notes: 'x',
    type: 'YIELD',
    updated_at: new Date(),
    with_finance: true,
  });

  expect(series).toEqual({
    accountId: 'acc-1',
    amountPerUnit: '1.1',
    assetId: 'asset-1',
    categoryId: 'cat-1',
    createdBy: 'user-1',
    currency: 'BRL',
    endDate: '2027-01-31',
    endedAt: '2026-11-15',
    endReason: 'MANUAL',
    exDateOffsetDays: 8,
    firstNumber: 23,
    firstPaymentDate: '2025-01-15',
    frequency: { interval: 2, unit: 'WEEK' },
    id: 'series-1',
    lastGeneratedNumber: 30,
    notes: 'x',
    type: 'YIELD',
    withFinance: true,
  });
});

it('SHOULD map the open fields to null', () => {
  const series = IncomeSeriesMapper.toSeries({
    account_id: null,
    amount_per_unit: new Prisma.Decimal('1'),
    asset_id: 'asset-1',
    category_id: null,
    created_at: new Date(),
    created_by: 'user-1',
    currency: 'BRL',
    end_date: null,
    end_reason: null,
    ended_at: null,
    ex_date_offset_days: null,
    first_number: 1,
    first_payment_date: new Date('2025-01-15T00:00:00Z'),
    frequency_interval: 1,
    frequency_unit: 'MONTH',
    id: 'series-1',
    last_generated_number: 0,
    notes: null,
    type: 'DIVIDEND',
    updated_at: new Date(),
    with_finance: false,
  });

  expect(series).toMatchObject({
    endDate: null,
    endedAt: null,
    endReason: null,
    exDateOffsetDays: null,
  });
});
