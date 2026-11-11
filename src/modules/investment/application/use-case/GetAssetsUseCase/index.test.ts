import {
  listRowFixture,
  operationFixture,
  valuationFixture,
} from '@investment/domain/entity/mocks/investment.fixture';
import { InvestmentAssetStatus, InvestmentOperationType } from '@investment/domain/enum';
import { Decimal8 } from '@shared/infra/decimal';

import { eventSpies, mocks, setup, spies } from './index.mocks';

it('SHOULD list the active assets of every accessible owner except archived families', async () => {
  spies.findAssetsByOwners.mockResolvedValue([]);

  await setup.execute({ accessibleOwners: mocks.owners });

  expect(spies.findAssetsByOwners).toHaveBeenCalledWith(
    [mocks.owners[0], mocks.owners[2]],
    InvestmentAssetStatus.ACTIVE,
  );
});

it('SHOULD narrow to one owner AND pass the archived status', async () => {
  spies.findAssetsByOwners.mockResolvedValue([]);

  await setup.execute({
    accessibleOwners: mocks.owners,
    ownerId: 'fam-archived',
    status: InvestmentAssetStatus.ARCHIVED,
  });

  expect(spies.findAssetsByOwners).toHaveBeenCalledWith(
    [mocks.owners[1]],
    InvestmentAssetStatus.ARCHIVED,
  );
});

it('SHOULD return nothing WHEN the owner id is not accessible', async () => {
  expect(await setup.execute({ accessibleOwners: mocks.owners, ownerId: 'stranger' })).toEqual([]);
  expect(spies.findAssetsByOwners).not.toHaveBeenCalled();
});

it('SHOULD derive the position AND the open result from operations and valuation', async () => {
  const asset = listRowFixture({
    latestValuation: valuationFixture({ unitPrice: Decimal8.parse('10.53') }),
    operations: [
      operationFixture({
        date: '2026-01-10',
        quantity: Decimal8.parse('1200'),
        total: 1178640,
        type: InvestmentOperationType.BUY,
      }),
    ],
  });
  spies.findAssetsByOwners.mockResolvedValue([asset]);

  const [view] = await setup.execute({ accessibleOwners: mocks.owners });

  expect(view.operationCount).toBe(1);
  expect(view.position).toMatchObject({
    averagePrice: '9.82200000',
    cost: 1178640,
    currentValue: 1263600,
    openResult: 84960,
    openResultPercent: 0.0721,
    realizedResult: 0,
  });
});

it('SHOULD leave the current value null WHEN there is no valuation', async () => {
  spies.findAssetsByOwners.mockResolvedValue([listRowFixture()]);

  const [view] = await setup.execute({ accessibleOwners: mocks.owners });

  expect(view.position).toMatchObject({
    currentUnitPrice: null,
    currentValue: null,
    openResult: null,
    openResultPercent: null,
  });
});

describe('corporate events (spec 108 FR 32)', () => {
  it('SHOULD count the pending event suggestions of each asset in one query', async () => {
    const first = listRowFixture();
    const second = listRowFixture();
    spies.findAssetsByOwners.mockResolvedValue([first, second]);
    eventSpies.countPendingByAsset.mockResolvedValue(new Map([[first.id, 2]]));

    const views = await setup.execute({ accessibleOwners: mocks.owners });

    expect(eventSpies.countPendingByAsset).toHaveBeenCalledTimes(1);
    expect(eventSpies.countPendingByAsset).toHaveBeenCalledWith([first.id, second.id]);
    expect(views.map((view) => view.pendingEventSuggestions)).toEqual([2, 0]);
  });

  it('SHOULD carry the count of pending fractions from the position', async () => {
    const row = listRowFixture({
      operations: [
        operationFixture({
          date: '2026-01-10',
          quantity: Decimal8.parse('3155'),
          total: 319100,
        }),
        operationFixture({
          date: '2026-03-10',
          event: { kind: 'SPLIT', ratioFrom: Decimal8.parse('10'), ratioTo: Decimal8.parse('1') },
          quantity: Decimal8.zero(),
          total: 0,
          type: InvestmentOperationType.REVERSE_SPLIT,
          unitPrice: Decimal8.zero(),
        }),
      ],
    });
    spies.findAssetsByOwners.mockResolvedValue([row]);

    const [view] = await setup.execute({ accessibleOwners: mocks.owners });

    expect(view.pendingFractionCount).toBe(1);
  });

  it('SHOULD not count anything WHEN there are no assets', async () => {
    expect(await setup.execute({ accessibleOwners: mocks.owners, ownerId: 'stranger' })).toEqual(
      [],
    );
    expect(eventSpies.countPendingByAsset).not.toHaveBeenCalled();
  });
});
