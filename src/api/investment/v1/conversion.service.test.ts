import { mocks, setup } from './conversion.service.mocks';

describe('create', () => {
  it('SHOULD convert from the origin with the resolved owners AND map both positions', async () => {
    mocks.useCases.create.execute.mockResolvedValue(mocks.writeResult);

    const result = await setup.create(mocks.userId, 'origin', {
      date: '2026-10-15',
      destination: { assetId: 'dest' },
      ratioFrom: '1',
      ratioTo: '7.4',
    });

    expect(mocks.useCases.create.execute).toHaveBeenCalledWith({
      accessibleOwners: mocks.accessibleOwners,
      assetId: 'origin',
      date: '2026-10-15',
      destination: { assetId: 'dest' },
      ratioFrom: '1',
      ratioTo: '7.4',
    });
    expect(result.item).toEqual({
      date: '2026-10-15',
      from: {
        assetId: mocks.view.from.assetId,
        cost: 808550,
        operationId: mocks.view.from.operationId,
        quantity: '103',
        ticker: 'BCFF11',
      },
      id: mocks.view.id,
      locked: false,
      ratioFrom: '1',
      ratioTo: '7.4',
      to: {
        assetId: mocks.view.to.assetId,
        cost: 808550,
        fractionCost: 212,
        fractionQuantity: '0.2',
        operationId: mocks.view.to.operationId,
        quantity: '762',
        ticker: 'BTHF11',
      },
    });
    expect(result.fromPosition.pendingFractions).toEqual([]);
    expect(result.toPosition.quantity).toBe('0');
  });
});

describe('findById', () => {
  it('SHOULD include the cash part AND leave out missing tickers', async () => {
    mocks.useCases.get.execute.mockResolvedValue({
      ...mocks.view,
      cashAmount: 1500,
      cashReferenceUnitValue: mocks.view.ratioTo,
      from: { ...mocks.view.from, ticker: null },
    });

    const result = await setup.findById(mocks.userId, 'conv-1');

    expect(mocks.useCases.get.execute).toHaveBeenCalledWith({
      accessibleOwners: mocks.accessibleOwners,
      id: 'conv-1',
    });
    expect(result.item).toMatchObject({ cashAmount: 1500, cashReferenceUnitValue: '7.4' });
    expect(result.item.from).not.toHaveProperty('ticker');
  });
});

describe('update AND delete', () => {
  it('SHOULD update with the conversion id AND the resolved owners', async () => {
    mocks.useCases.update.execute.mockResolvedValue(mocks.writeResult);

    await setup.update(mocks.userId, 'conv-1', { ratioTo: '2' });

    expect(mocks.useCases.update.execute).toHaveBeenCalledWith({
      accessibleOwners: mocks.accessibleOwners,
      id: 'conv-1',
      ratioTo: '2',
    });
  });

  it('SHOULD delete with the resolved owners', async () => {
    await setup.delete(mocks.userId, 'conv-1');

    expect(mocks.useCases.delete.execute).toHaveBeenCalledWith({
      accessibleOwners: mocks.accessibleOwners,
      id: 'conv-1',
    });
  });
});
