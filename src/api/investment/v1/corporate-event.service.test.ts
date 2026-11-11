import { mocks, setup } from './corporate-event.service.mocks';

describe('createFractionSale', () => {
  it('SHOULD sell the fraction of the event with the resolved owners AND map the result', async () => {
    mocks.useCases.createFractionSale.execute.mockResolvedValue(mocks.writeResult);

    const result = await setup.createFractionSale(mocks.userId, 'event-1', {
      accountId: 'acc-1',
      date: '2026-04-04',
      grossAmount: 520,
    });

    expect(mocks.useCases.createFractionSale.execute).toHaveBeenCalledWith({
      accessibleOwners: mocks.accessibleOwners,
      accountId: 'acc-1',
      date: '2026-04-04',
      eventId: 'event-1',
      grossAmount: 520,
    });
    expect(result.item).toMatchObject({
      costRemoved: 506,
      fractionOfOperationId: mocks.operation.fractionOfOperationId,
      quantity: '0.5',
      realizedResult: 14,
    });
    expect(result.position.pendingFractions).toEqual([]);
  });
});

describe('findSuggestions', () => {
  it('SHOULD list the page with the count AND leave the nulls out', async () => {
    mocks.useCases.getSuggestions.execute.mockResolvedValue(mocks.suggestionPage);

    const result = await setup.findSuggestions(mocks.userId, { assetId: 'a', limit: 50 });

    expect(mocks.useCases.getSuggestions.execute).toHaveBeenCalledWith({
      accessibleOwners: mocks.accessibleOwners,
      assetId: 'a',
      limit: 50,
    });
    expect(result.count).toBe(1);
    expect(result.nextCursor).toBeNull();
    expect(result.items[0]).toEqual({
      assetId: mocks.suggestionPage.items[0].assetId,
      averagePriceAfter: '9.61109827',
      bonusPercent: '10',
      currency: 'BRL',
      date: '2026-11-18',
      fractionQuantity: '0.5',
      id: mocks.suggestionPage.items[0].id,
      quantityAfter: '346',
      quantityBefore: '315',
      ticker: 'MGLU3',
      type: 'BONUS',
    });
  });

  it('SHOULD keep the ratio AND the unit cost WHEN they are set', async () => {
    mocks.useCases.getSuggestions.execute.mockResolvedValue({
      items: [
        {
          ...mocks.suggestionPage.items[0],
          averagePriceBefore: '1.01',
          bonusUnitCost: '4.5',
          ratioFrom: '10',
          ratioTo: '1',
        },
      ],
      nextCursor: 'next',
    });

    const result = await setup.findSuggestions(mocks.userId, {});

    expect(result.items[0]).toMatchObject({
      averagePriceBefore: '1.01',
      bonusUnitCost: '4.5',
      ratioFrom: '10',
      ratioTo: '1',
    });
    expect(result.nextCursor).toBe('next');
  });
});

describe('approveSuggestion', () => {
  it('SHOULD approve with the overrides, the owners AND who decided', async () => {
    mocks.useCases.approve.execute.mockResolvedValue(mocks.writeResult);

    await setup.approveSuggestion(mocks.userId, 'sug-1', { bonusPercent: '5' });

    expect(mocks.useCases.approve.execute).toHaveBeenCalledWith({
      accessibleOwners: mocks.accessibleOwners,
      bonusPercent: '5',
      id: 'sug-1',
      userId: mocks.userId,
    });
  });
});

describe('rejectSuggestion', () => {
  it('SHOULD reject for the caller', async () => {
    await setup.rejectSuggestion(mocks.userId, 'sug-1');

    expect(mocks.useCases.reject.execute).toHaveBeenCalledWith({
      accessibleOwners: mocks.accessibleOwners,
      id: 'sug-1',
      userId: mocks.userId,
    });
  });
});
