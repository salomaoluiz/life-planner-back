import { operationFixture } from '@investment/domain/entity/mocks/investment.fixture';
import { InvestmentAssetStatus, InvestmentOperationType } from '@investment/domain/enum';
import { Decimal8 } from '@shared/infra/decimal';

import { toAssetItem, toOperation, toPosition } from './investment.service';
import { mocks, setup } from './investment.service.mocks';

const assetItem = {
  archivedAt: null,
  assetClass: 'BR_STOCK',
  averageFxRate: null,
  costBrl: null,
  currency: 'BRL',
  currentPriceSource: 'MANUAL',
  fixedIncome: null,
  fx: null,
  id: mocks.asset.id,
  marketValueBrl: null,
  name: 'Itausa PN',
  operationCount: 1,
  operationsWithoutFxRate: 0,
  owner: 'USER',
  ownerId: mocks.userId,
  pendingFractionCount: 0,
  position: mocks.positionApi,
  quote: null,
  resultBrl: null,
  resultBrlFromAsset: null,
  resultBrlFromFx: null,
  resultBrlPercent: null,
  status: 'ACTIVE',
  ticker: 'ITSA4',
};

describe('reads', () => {
  it('SHOULD list the assets mapped to the API shape with the resolved owners', async () => {
    mocks.useCases.getAssets.execute.mockResolvedValue([mocks.view]);

    const result = await setup.findAssets(mocks.userId, {
      ownerId: 'x',
      status: InvestmentAssetStatus.ARCHIVED,
    });

    expect(mocks.useCases.getAssets.execute).toHaveBeenCalledWith({
      accessibleOwners: mocks.accessibleOwners,
      ownerId: 'x',
      status: 'ARCHIVED',
    });
    expect(result).toEqual({ items: [assetItem] });
  });

  it('SHOULD give the detail with operations (decimal strings) and valuations', async () => {
    mocks.useCases.getAssetById.execute.mockResolvedValue(mocks.detailView);

    const { item } = await setup.findAssetById(mocks.userId, mocks.asset.id);

    expect(item.operations[0]).toMatchObject({
      costRemoved: 294660,
      feesTotal: 0,
      quantity: '18.3572',
      realizedResult: 31790,
      unitPrice: '10.5',
    });
    expect(item.operations[0].fees).toHaveLength(1);
    expect(item.valuations[0]).toEqual({
      date: mocks.valuation.date,
      id: mocks.valuation.id,
      source: 'MANUAL',
      unitPrice: '10.53',
    });
    expect(item.position.quantity).toBe('1200');
  });

  it('SHOULD keep nulls for an asset without valuation or archive date', async () => {
    mocks.useCases.getAssets.execute.mockResolvedValue([
      {
        ...mocks.view,
        asset: { ...mocks.asset, archivedAt: new Date('2026-11-09T00:00:00Z') },
        position: { ...mocks.view.position, currentUnitPrice: null },
      },
    ]);

    const { items } = await setup.findAssets(mocks.userId, {});

    expect(items[0].archivedAt).toBe('2026-11-09T00:00:00.000Z');
    expect(items[0].position.currentUnitPrice).toBeNull();
  });
});

describe('writes', () => {
  it('SHOULD create and update an asset with the resolved owners', async () => {
    mocks.useCases.createAsset.execute.mockResolvedValue(mocks.view);
    mocks.useCases.updateAsset.execute.mockResolvedValue(mocks.view);

    expect(
      await setup.createAsset(mocks.userId, {
        assetClass: 'BR_STOCK' as never,
        name: 'Itausa',
        owner: 'USER' as never,
        ownerId: mocks.userId,
      }),
    ).toEqual(assetItem);
    await setup.updateAsset(mocks.userId, mocks.asset.id, { name: 'New' });

    expect(mocks.useCases.createAsset.execute).toHaveBeenCalledWith(
      expect.objectContaining({ accessibleOwners: mocks.accessibleOwners }),
    );
    expect(mocks.useCases.updateAsset.execute).toHaveBeenCalledWith({
      accessibleOwners: mocks.accessibleOwners,
      id: mocks.asset.id,
      name: 'New',
    });
  });

  it('SHOULD return the operation with the new position on create and update', async () => {
    const result = {
      asset: mocks.view,
      operation: { costRemoved: null, operation: mocks.operation, realizedResult: null },
    };
    mocks.useCases.createOperation.execute.mockResolvedValue(result);
    mocks.useCases.updateOperation.execute.mockResolvedValue(result);

    const created = await setup.createOperation(mocks.userId, mocks.asset.id, {
      date: '2026-06-10',
      quantity: '1',
      type: 'BUY' as never,
      unitPrice: '1',
    });
    const updated = await setup.updateOperation(mocks.userId, mocks.operation.id, {
      quantity: '2',
    });

    expect(created.position).toEqual(mocks.positionApi);
    expect(created.item.transactionId).toBe(mocks.operation.transactionId);
    expect(updated.item.id).toBe(mocks.operation.id);
    expect(mocks.useCases.createOperation.execute).toHaveBeenCalledWith(
      expect.objectContaining({ assetId: mocks.asset.id }),
    );
  });

  it('SHOULD upsert a valuation AND return the refreshed position', async () => {
    mocks.useCases.upsertValuation.execute.mockResolvedValue({
      asset: mocks.view,
      valuation: mocks.valuation,
    });

    const result = await setup.upsertValuation(mocks.userId, mocks.asset.id, '2026-11-01', {
      unitPrice: '10.61',
    });

    expect(mocks.useCases.upsertValuation.execute).toHaveBeenCalledWith({
      accessibleOwners: mocks.accessibleOwners,
      assetId: mocks.asset.id,
      date: '2026-11-01',
      unitPrice: '10.61',
    });
    expect(result.position).toEqual(mocks.positionApi);
  });

  it('SHOULD forward the three deletes with the resolved owners', async () => {
    await setup.deleteAsset(mocks.userId, 'a');
    await setup.deleteOperation(mocks.userId, 'o');
    await setup.deleteValuation(mocks.userId, 'v');

    for (const [useCase, id] of [
      [mocks.useCases.deleteAsset, 'a'],
      [mocks.useCases.deleteOperation, 'o'],
      [mocks.useCases.deleteValuation, 'v'],
    ] as const) {
      expect(useCase.execute).toHaveBeenCalledWith({
        accessibleOwners: mocks.accessibleOwners,
        id,
      });
    }
  });
});

describe('quotes (spec 104)', () => {
  it('SHOULD map a USD asset with its quote, rate and BRL split', async () => {
    const quotedAt = new Date('2026-11-04T16:00:00Z');
    mocks.useCases.getAssets.execute.mockResolvedValue([
      {
        ...mocks.view,
        market: {
          fx: { quotedAt, rate: '5.5601' },
          priceSource: 'QUOTE',
          quote: {
            changePercent: '1.24',
            dayHigh: null,
            dayLow: null,
            market: 'US',
            previousClose: '228.57',
            price: '231.4',
            quotedAt,
            source: 'FINNHUB',
            stale: false,
            ticker: 'AAPL',
            unavailable: false,
          },
          usd: {
            averageFxRate: '5.2236',
            operationsWithoutFxRate: 1,
            result: {
              costBrl: 1902435,
              marketValueBrl: 2573214,
              resultBrl: 670779,
              resultBrlFromAsset: 515047,
              resultBrlFromFx: 155732,
              resultBrlPercent: 0.3526,
            },
          },
        },
      },
    ]);

    const { items } = await setup.findAssets(mocks.userId, {});

    expect(items[0]).toMatchObject({
      averageFxRate: '5.2236',
      currentPriceSource: 'QUOTE',
      fx: { quotedAt: quotedAt.toISOString(), rate: '5.5601' },
      operationsWithoutFxRate: 1,
      quote: { quotedAt: quotedAt.toISOString(), stale: false, ticker: 'AAPL' },
      resultBrl: 670779,
      resultBrlFromAsset: 515047,
      resultBrlFromFx: 155732,
      resultBrlPercent: 0.3526,
    });
  });

  it('SHOULD read the price history, search tickers AND refresh with the resolved owners', async () => {
    mocks.useCases.getPriceHistory.execute.mockResolvedValue({ points: [] });
    mocks.useCases.searchTickers.execute.mockResolvedValue([{ ticker: 'ITSA4' }]);
    mocks.useCases.refreshQuotesNow.execute.mockResolvedValue({
      fx: { pair: 'USD-BRL', quotedAt: new Date('2026-11-04T16:00:00Z'), rate: '5.5601' },
      nextRefreshAt: new Date('2026-11-04T16:01:00Z'),
      quotes: [],
    });

    expect(await setup.priceHistory(mocks.userId, 'a1', '1Y')).toEqual({ points: [] });
    expect(mocks.useCases.getPriceHistory.execute).toHaveBeenCalledWith({
      accessibleOwners: mocks.accessibleOwners,
      id: 'a1',
      range: '1Y',
    });
    expect(await setup.searchTickers({ market: 'B3' as never, q: 'itsa' })).toEqual({
      items: [{ ticker: 'ITSA4' }],
    });
    expect(await setup.refreshQuotes(mocks.userId, ['a1'])).toEqual({
      fx: { pair: 'USD-BRL', quotedAt: '2026-11-04T16:00:00.000Z', rate: '5.5601' },
      nextRefreshAt: '2026-11-04T16:01:00.000Z',
      quotes: [],
    });
    expect(mocks.useCases.refreshQuotesNow.execute).toHaveBeenCalledWith({
      accessibleOwners: mocks.accessibleOwners,
      assetIds: ['a1'],
      userId: mocks.userId,
    });
  });

  it('SHOULD return a null rate WHEN the refresh had none', async () => {
    mocks.useCases.refreshQuotesNow.execute.mockResolvedValue({
      fx: null,
      nextRefreshAt: new Date('2026-11-04T16:01:00Z'),
      quotes: [],
    });

    expect((await setup.refreshQuotes(mocks.userId)).fx).toBeNull();
  });
});

describe('corporate events (spec 108)', () => {
  const eventOperation = operationFixture({
    assetId: mocks.asset.id,
    date: '2026-03-10',
    event: { kind: 'SPLIT', ratioFrom: Decimal8.parse('10'), ratioTo: Decimal8.parse('1') },
    id: '3b0e8f5a-6d1c-4f0e-9a52-1c2d3e4f5a6b',
    quantity: Decimal8.zero(),
    total: 0,
    type: InvestmentOperationType.REVERSE_SPLIT,
    unitPrice: Decimal8.zero(),
  });
  const eventView = {
    costRemoved: null,
    event: {
      averagePriceAfter: '10.11409524',
      averagePriceBefore: '1.01141046',
      costAfter: 318594,
      costBefore: 319100,
      fractionCost: 506,
      fractionQuantity: Decimal8.parse('0.5'),
      quantityAfter: Decimal8.parse('315'),
      quantityBefore: Decimal8.parse('3155'),
    },
    operation: eventOperation,
    realizedResult: null,
  };

  it('SHOULD map an event with its fields AND before/after, without the buy and sell fields', () => {
    expect(toOperation(eventView)).toEqual({
      averagePriceAfter: '10.11409524',
      averagePriceBefore: '1.01141046',
      costRemoved: null,
      date: '2026-03-10',
      fees: [],
      fractionCost: 506,
      fractionQuantity: '0.5',
      id: eventOperation.id,
      quantityAfter: '315',
      quantityBefore: '3155',
      ratioFrom: '10',
      ratioTo: '1',
      realizedResult: null,
      type: 'REVERSE_SPLIT',
    });
  });

  it('SHOULD map a bonus with its percent AND unit cost', () => {
    const operation = {
      ...eventView,
      operation: {
        ...eventOperation,
        event: {
          kind: 'BONUS' as const,
          percent: Decimal8.parse('10'),
          unitCost: Decimal8.parse('4.5'),
        },
        type: InvestmentOperationType.BONUS,
      },
    };

    expect(toOperation(operation)).toMatchObject({
      bonusPercent: '10',
      bonusUnitCost: '4.5',
      type: 'BONUS',
    });
    expect(toOperation(operation)).not.toHaveProperty('ratioFrom');
  });

  it('SHOULD omit the unit cost of a bonus that has none', () => {
    const operation = {
      ...eventView,
      operation: {
        ...eventOperation,
        event: { kind: 'BONUS' as const, percent: Decimal8.parse('10'), unitCost: null },
        type: InvestmentOperationType.BONUS,
      },
    };

    expect(toOperation(operation)).not.toHaveProperty('bonusUnitCost');
  });

  it('SHOULD keep the trade fields of a fraction sale AND link it to its event', () => {
    const sale = {
      costRemoved: 506,
      event: null,
      operation: operationFixture({
        fractionOfOperationId: eventOperation.id,
        id: '4c1f9a6b-7e2d-4a1f-8b63-2d3e4f5a6b7c',
        quantity: Decimal8.parse('0.5'),
        type: InvestmentOperationType.SELL,
      }),
      realizedResult: 14,
    };

    expect(toOperation(sale)).toMatchObject({
      costRemoved: 506,
      fractionOfOperationId: eventOperation.id,
      quantity: '0.5',
      realizedResult: 14,
    });
  });

  it('SHOULD list the pending fractions in the position', () => {
    const position = {
      ...mocks.view.position,
      pendingFractions: [
        {
          cost: 506,
          date: '2026-03-10',
          eventId: eventOperation.id,
          quantity: Decimal8.parse('0.5'),
        },
      ],
    };

    expect(toPosition(position).pendingFractions).toEqual([
      { cost: 506, date: '2026-03-10', eventId: eventOperation.id, quantity: '0.5' },
    ]);
  });

  it('SHOULD add the pending counts to a list item only WHEN the list gives them', () => {
    expect(
      toAssetItem({ ...mocks.view, pendingEventSuggestions: 2, pendingFractionCount: 1 }),
    ).toMatchObject({
      pendingEventSuggestions: 2,
      pendingFractionCount: 1,
    });
    expect(toAssetItem(mocks.view)).not.toHaveProperty('pendingEventSuggestions');
  });

  it('SHOULD create an event through its own use case AND a buy through the operation one', async () => {
    mocks.useCases.createEvent.execute.mockResolvedValue({
      asset: mocks.view,
      operation: eventView,
    });
    mocks.useCases.createOperation.execute.mockResolvedValue({
      asset: mocks.view,
      operation: mocks.detailView.operations[0],
    });

    const created = await setup.createOperation(mocks.userId, mocks.asset.id, {
      date: '2026-03-10',
      ratioFrom: '10',
      ratioTo: '1',
      type: InvestmentOperationType.REVERSE_SPLIT,
    });

    expect(mocks.useCases.createEvent.execute).toHaveBeenCalledWith({
      accessibleOwners: mocks.accessibleOwners,
      assetId: mocks.asset.id,
      date: '2026-03-10',
      ratioFrom: '10',
      ratioTo: '1',
      type: 'REVERSE_SPLIT',
    });
    expect(mocks.useCases.createOperation.execute).not.toHaveBeenCalled();
    expect(created.item.type).toBe('REVERSE_SPLIT');

    await setup.createOperation(mocks.userId, mocks.asset.id, {
      date: '2026-06-10',
      quantity: '1',
      type: InvestmentOperationType.BUY,
      unitPrice: '1',
    });

    expect(mocks.useCases.createOperation.execute).toHaveBeenCalledTimes(1);
  });
});
