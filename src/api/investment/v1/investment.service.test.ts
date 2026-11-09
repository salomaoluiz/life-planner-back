import { InvestmentAssetStatus } from '@investment/domain/enum';

import { mocks, setup } from './investment.service.mocks';

const assetItem = {
  archivedAt: null,
  assetClass: 'BR_STOCK',
  currency: 'BRL',
  id: mocks.asset.id,
  name: 'Itausa PN',
  operationCount: 1,
  owner: 'USER',
  ownerId: mocks.userId,
  position: mocks.positionApi,
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
