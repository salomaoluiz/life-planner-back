import { BadRequestException, NotFoundException } from '@nestjs/common';

import { incomeFixture } from '@investment/domain/entity/mocks/income.fixture';
import { InvestmentIncomeType } from '@investment/domain/enum';
import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { decodeCursor, encodeCursor } from './index';
import { scenario, setup, spies } from './index.mocks';

const base = { accessibleOwners: scenario.owners, assetId: scenario.asset.id };
const rows = [
  incomeFixture({ id: 'inc-3', paymentDate: '2026-12-19' }),
  incomeFixture({ id: 'inc-2', paymentDate: '2026-10-30' }),
  incomeFixture({ id: 'inc-1', paymentDate: '2026-09-30' }),
];

beforeEach(() => {
  spies.incomes.findIncomes.mockResolvedValue(rows);
  spies.incomes.incomeTotals.mockResolvedValue({ planned: 14100, received: 128460 });
  spies.incomes.countPendingSuggestions.mockResolvedValue(2);
});

it('SHOULD page one asset by keyset AND answer the summary of the current year', async () => {
  jest.useFakeTimers().setSystemTime(new Date('2026-11-04T15:00:00Z'));

  const result = await setup.execute({ ...base, limit: 2 });

  jest.useRealTimers();

  expect(spies.incomes.findIncomes).toHaveBeenCalledWith(
    expect.objectContaining({ assetId: scenario.asset.id, limit: 3 }),
  );
  expect(result.items.map((item) => item.income.id)).toEqual(['inc-3', 'inc-2']);
  expect(result.nextCursor).toBe(encodeCursor({ id: 'inc-2', paymentDate: '2026-10-30' }));
  expect(result.summary).toEqual({
    currency: 'BRL',
    pendingSuggestions: 2,
    plannedTotal: 14100,
    receivedThisYear: 128460,
  });
  expect(spies.incomes.incomeTotals).toHaveBeenCalledWith(
    scenario.asset.id,
    '2026-01-01',
    '2026-12-31',
  );
});

it('SHOULD answer no cursor on the last page AND pass the cursor AND the filters on', async () => {
  const cursor = encodeCursor({ id: 'inc-9', paymentDate: '2026-11-01' });
  const result = await setup.execute({
    ...base,
    cursor,
    status: 'PLANNED',
    type: InvestmentIncomeType.JCP,
  });

  expect(result.nextCursor).toBeNull();
  expect(spies.incomes.findIncomes).toHaveBeenCalledWith(
    expect.objectContaining({
      cursor: { id: 'inc-9', paymentDate: '2026-11-01' },
      limit: 51,
      status: 'PLANNED',
      type: InvestmentIncomeType.JCP,
    }),
  );
});

it('SHOULD list every readable asset for a period without a summary, narrowed by owner', async () => {
  const owners = [
    { owner: OwnerType.USER, ownerId: 'user-1' },
    { owner: OwnerType.FAMILY, ownerId: 'family-1' },
  ];
  const result = await setup.execute({
    accessibleOwners: owners,
    from: '2026-01-01',
    owner: 'FAMILY',
    to: '2026-12-31',
  });

  expect(result.summary).toBeUndefined();
  expect(spies.incomes.findIncomes).toHaveBeenCalledWith(
    expect.objectContaining({ assetId: undefined, owners: [owners[1]] }),
  );

  await setup.execute({
    accessibleOwners: owners,
    from: '2026-01-01',
    owner: 'ALL',
    to: '2026-12-31',
  });
  expect(spies.incomes.findIncomes).toHaveBeenLastCalledWith(expect.objectContaining({ owners }));
});

it('SHOULD answer 400 WITHOUT an asset and a period, OR for a period above 2 years', async () => {
  await expect(setup.execute({ accessibleOwners: scenario.owners })).rejects.toBeInstanceOf(
    BadRequestException,
  );
  await expect(
    setup.execute({ accessibleOwners: scenario.owners, from: '2026-01-01' }),
  ).rejects.toBeInstanceOf(BadRequestException);
  await expect(
    setup.execute({ accessibleOwners: scenario.owners, from: '2024-01-01', to: '2026-01-02' }),
  ).rejects.toBeInstanceOf(BadRequestException);
  await expect(
    setup.execute({ accessibleOwners: scenario.owners, from: '2024-01-01', to: '2026-01-01' }),
  ).resolves.toBeDefined();
});

it('SHOULD answer 400 for a broken cursor AND 404 for an unreadable asset', async () => {
  await expect(setup.execute({ ...base, cursor: 'not-a-cursor' })).rejects.toBeInstanceOf(
    BadRequestException,
  );

  spies.investment.findAssetById.mockResolvedValueOnce(undefined);
  await expect(setup.execute(base)).rejects.toBeInstanceOf(NotFoundException);
});

it('SHOULD round-trip the cursor', () => {
  const cursor = { id: 'abc', paymentDate: '2026-10-30' };

  expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
});
