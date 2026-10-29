import { NotFoundException } from '@nestjs/common';

import { mocks, setup } from './credit-card.service.mocks';

describe('create', () => {
  it('SHOULD resolve the owners, call the use case AND return the API shape (ISO dates)', async () => {
    const result = await setup.create(mocks.userId, mocks.createBody as never);

    expect(mocks.financeAccessService.resolve).toHaveBeenCalledWith(mocks.userId);
    expect(mocks.createUseCase.execute).toHaveBeenCalledWith({
      ...mocks.createBody,
      accessibleOwners: mocks.accessibleOwners,
    });
    expect(result).toEqual(mocks.cardApi);
  });

  it('SHOULD fail AND not call the use case WHEN the owner resolution fails', async () => {
    mocks.financeAccessService.resolve.mockRejectedValueOnce(new Error('db down'));

    await expect(setup.create(mocks.userId, mocks.createBody as never)).rejects.toThrow('db down');
    expect(mocks.createUseCase.execute).not.toHaveBeenCalled();
  });
});

describe('findAll', () => {
  it('SHOULD forward ownerIds and status AND map every card', async () => {
    const result = await setup.findAll(mocks.userId, ['a'], 'ARCHIVED' as never);

    expect(mocks.getUseCase.execute).toHaveBeenCalledWith({
      accessibleOwners: mocks.accessibleOwners,
      ownerIds: ['a'],
      status: 'ARCHIVED',
    });
    expect(result).toEqual([mocks.cardApi]);
  });
});

describe('findOne', () => {
  it('SHOULD return the mapped card', async () => {
    expect(await setup.findOne(mocks.userId, mocks.cardApi.id)).toEqual(mocks.cardApi);
    expect(mocks.getByIdUseCase.execute).toHaveBeenCalledWith({
      accessibleOwners: mocks.accessibleOwners,
      id: mocks.cardApi.id,
    });
  });
});

describe('archivedAt', () => {
  it('SHOULD return the archive instant as ISO', async () => {
    mocks.getByIdUseCase.execute.mockResolvedValueOnce({
      ...mocks.cardResult,
      archivedAt: new Date('2026-10-10T12:00:00.000Z'),
    });

    const result = await setup.findOne(mocks.userId, mocks.cardApi.id);

    expect(result.archivedAt).toBe('2026-10-10T12:00:00.000Z');
  });
});

describe('findOverview', () => {
  beforeEach(() => jest.useFakeTimers({ now: new Date('2026-10-15T12:00:00.000Z') }));
  afterEach(() => jest.useRealTimers());

  it('SHOULD pass today in São Paulo AND map cards, invoices and aggregate', async () => {
    const result = await setup.findOverview(mocks.userId, ['a']);
    await setup.findOverview(mocks.userId, ['a'], '2026-11-02');

    expect(mocks.overviewUseCase.execute).toHaveBeenCalledWith({
      accessibleOwners: mocks.accessibleOwners,
      ownerIds: ['a'],
      today: '2026-10-15',
    });
    expect(mocks.overviewUseCase.execute).toHaveBeenLastCalledWith(
      expect.objectContaining({ today: '2026-11-02' }),
    );
    expect(result).toEqual(mocks.overviewApi);
  });
});

describe('update', () => {
  it('SHOULD forward the id and the patch (null kept)', async () => {
    await setup.update(mocks.userId, mocks.cardApi.id, { paymentDay: null });

    expect(mocks.updateUseCase.execute).toHaveBeenCalledWith({
      accessibleOwners: mocks.accessibleOwners,
      id: mocks.cardApi.id,
      paymentDay: null,
    });
  });
});

describe('delete', () => {
  it('SHOULD delegate with the resolved owners', async () => {
    await setup.delete(mocks.userId, mocks.cardApi.id);

    expect(mocks.deleteUseCase.execute).toHaveBeenCalledWith({
      accessibleOwners: mocks.accessibleOwners,
      id: mocks.cardApi.id,
    });
  });

  it('SHOULD propagate NotFound from the use case', async () => {
    mocks.deleteUseCase.execute.mockRejectedValueOnce(new NotFoundException());

    await expect(setup.delete(mocks.userId, 'x')).rejects.toThrow(NotFoundException);
  });
});

describe('paymentAccount (spec 035)', () => {
  it('SHOULD read the linked accounts ONCE per request AND fill paymentAccount', async () => {
    mocks.getUseCase.execute.mockResolvedValueOnce([mocks.cardResult, mocks.cardResult]);

    await setup.findAll(mocks.userId);

    expect(mocks.getAccountsByIdsUseCase.execute).toHaveBeenCalledTimes(1);
    expect(mocks.getAccountsByIdsUseCase.execute).toHaveBeenCalledWith({
      accessibleOwners: mocks.accessibleOwners,
      ids: [mocks.linkedAccountId, mocks.linkedAccountId],
    });
  });

  it('SHOULD keep paymentAccountId AND set paymentAccount null WHEN the reader cannot access it', async () => {
    mocks.getAccountsByIdsUseCase.execute.mockResolvedValueOnce([]);

    const result = await setup.findOne(mocks.userId, mocks.cardApi.id);

    expect(result.paymentAccountId).toBe(mocks.linkedAccountId);
    expect(result.paymentAccount).toBeNull();
  });

  it('SHOULD return nulls for a card without a link', async () => {
    mocks.getByIdUseCase.execute.mockResolvedValueOnce({
      ...mocks.cardResult,
      paymentAccountId: undefined,
    });

    const result = await setup.findOne(mocks.userId, mocks.cardApi.id);

    expect(result.paymentAccountId).toBeNull();
    expect(result.paymentAccount).toBeNull();
  });
});
