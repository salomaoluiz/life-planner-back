import { PATH_METADATA, VERSION_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';

import { DashboardController } from '@api/finance/v1/dashboard.controller';
import { DashboardService } from '@api/finance/v1/dashboard.service';
import { ValidationError } from '@shared/domain/error/ValidationError';

const serviceMock = {
  getBalanceSeries: jest.fn().mockResolvedValue({ points: [] }),
  getSummary: jest.fn().mockResolvedValue({ currency: 'BRL' }),
  getTotals: jest.fn().mockResolvedValue({ groupBy: 'PERIOD', items: [] }),
};
const request = { user: { id: 'user-1' } } as never;
const id = '6f1c2b9e-1d2a-4c55-9a7e-0b8e3c1f2a10';
const query = { currency: 'BRL', from: '2025-11-01', to: '2026-10-31', today: '2026-10-20' };

async function build() {
  const module = await Test.createTestingModule({
    controllers: [DashboardController],
    providers: [{ provide: DashboardService, useValue: serviceMock }],
  }).compile();

  return module.get(DashboardController);
}

it('SHOULD be served at /finance/dashboard under URI version 1', () => {
  expect(Reflect.getMetadata(PATH_METADATA, DashboardController)).toBe('finance/dashboard');
  expect(Reflect.getMetadata(VERSION_METADATA, DashboardController)).toBe('1');
});

it('SHOULD forward the period, scope, currency AND the 045 filters to the summary', async () => {
  const setup = await build();

  const result = await setup.summary(request, {
    ...query,
    categoryId: id,
    ownerId: [id],
    paid: 'true',
    q: ' mercado ',
    tagId: [id],
  });

  expect(serviceMock.getSummary).toHaveBeenCalledWith('user-1', {
    currency: 'BRL',
    filter: {
      accountIds: undefined,
      categoryIds: [id],
      creditCardIds: undefined,
      paid: true,
      q: 'mercado',
      source: undefined,
      tagIds: [id],
    },
    from: '2025-11-01',
    ownerIds: [id],
    to: '2026-10-31',
    today: '2026-10-20',
  });
  expect(result).toEqual({ currency: 'BRL' });
});

it('SHOULD accept a `to` on the last day of the month 24 months ahead (spec 053)', async () => {
  const setup = await build();

  await setup.summary(request, { ...query, from: '2027-01-01', to: '2028-10-31' });

  expect(serviceMock.getSummary).toHaveBeenCalled();
});

it.each([
  ['a `to` after the 24-month limit', { ...query, from: '2027-01-01', to: '2028-11-01' }],
  ['a range over 2 years', { ...query, from: '2024-10-01' }],
  ['a `to` before `from`', { ...query, from: '2026-10-10', to: '2026-10-01' }],
  ['an unknown currency', { ...query, currency: 'XXX' }],
  ['a missing currency', { from: query.from, to: query.to }],
])('SHOULD reject %s', async (_label, bad) => {
  const setup = await build();

  await expect(setup.summary(request, bad)).rejects.toThrow(ValidationError);
});

it('SHOULD pass the granularity to the balance series AND reject an unknown one', async () => {
  const setup = await build();

  await setup.balanceSeries(request, { ...query, granularity: 'MONTH' });

  expect(serviceMock.getBalanceSeries).toHaveBeenCalledWith(
    'user-1',
    expect.objectContaining({ currency: 'BRL' }),
    'MONTH',
  );
  await expect(setup.balanceSeries(request, { ...query, granularity: 'YEAR' })).rejects.toThrow(
    ValidationError,
  );
});

it('SHOULD pass the grouping to the totals AND require the type for category and tag', async () => {
  const setup = await build();

  await setup.totals(request, { ...query, groupBy: 'CATEGORY', parentId: id, type: 'EXPENSE' });

  expect(serviceMock.getTotals).toHaveBeenCalledWith('user-1', expect.anything(), {
    groupBy: 'CATEGORY',
    parentId: id,
    type: 'EXPENSE',
  });
  await setup.totals(request, { ...query, groupBy: 'PERIOD' });
  await expect(setup.totals(request, { ...query, groupBy: 'TAG' })).rejects.toThrow(
    ValidationError,
  );
  await expect(setup.totals(request, { ...query, groupBy: 'NOPE' })).rejects.toThrow(
    ValidationError,
  );
});
