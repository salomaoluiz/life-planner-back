import { ForbiddenException, NotFoundException } from '@nestjs/common';

import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';
import { StockUnits } from '@stock/domain/entity/StockEntity';

import { mocks, setup } from './stock.service.mocks';

const body = {
  description: 'Whole milk',
  owner: OwnerType.FAMILY,
  ownerId: mocks.familyId,
  quantity: 6,
  unit: StockUnits.LITER,
};

describe('owner resolution', () => {
  it('SHOULD build [USER self, ...FAMILY ids] on EVERY call (a removed member loses access at once)', async () => {
    await setup.findAll(mocks.userId);
    mocks.getUserFamilyIdsUseCase.execute.mockResolvedValueOnce([]);
    await setup.findAll(mocks.userId);

    expect(mocks.getUserFamilyIdsUseCase.execute).toHaveBeenCalledTimes(2);
    expect(mocks.getListUseCase.execute).toHaveBeenNthCalledWith(1, {
      accessibleOwners: mocks.accessibleOwners,
      ownerId: undefined,
    });
    expect(mocks.getListUseCase.execute).toHaveBeenNthCalledWith(2, {
      accessibleOwners: [mocks.accessibleOwners[0]],
      ownerId: undefined,
    });
  });

  it('SHOULD fail (no partial result) AND not call the stock use case WHEN the family lookup fails', async () => {
    mocks.getUserFamilyIdsUseCase.execute.mockRejectedValueOnce(new Error('db down'));

    await expect(setup.findAll(mocks.userId)).rejects.toThrow('db down');
    expect(mocks.getListUseCase.execute).not.toHaveBeenCalled();
  });
});

describe('findAll', () => {
  it('SHOULD forward ownerId AND return the API shape (ISO dates, null for absent)', async () => {
    const result = await setup.findAll(mocks.userId, mocks.familyId);

    expect(mocks.getListUseCase.execute).toHaveBeenCalledWith({
      accessibleOwners: mocks.accessibleOwners,
      ownerId: mocks.familyId,
    });
    expect(result).toEqual([mocks.itemApi]);
  });

  it('SHOULD return [] WHEN there are no items', async () => {
    mocks.getListUseCase.execute.mockResolvedValueOnce([]);

    expect(await setup.findAll(mocks.userId)).toEqual([]);
  });
});

describe('findById', () => {
  it('SHOULD return the API shape', async () => {
    expect(await setup.findById(mocks.userId, mocks.itemApi.id)).toEqual(mocks.itemApi);
    expect(mocks.getByIdUseCase.execute).toHaveBeenCalledWith({
      accessibleOwners: mocks.accessibleOwners,
      id: mocks.itemApi.id,
    });
  });

  it('SHOULD propagate NotFound (404)', async () => {
    mocks.getByIdUseCase.execute.mockRejectedValueOnce(new NotFoundException());

    await expect(setup.findById(mocks.userId, 'x')).rejects.toThrow(NotFoundException);
  });
});

describe('create', () => {
  it('SHOULD pass the body with the accessible owners AND return the API shape', async () => {
    const result = await setup.create(mocks.userId, body);

    expect(mocks.createUseCase.execute).toHaveBeenCalledWith({
      ...body,
      accessibleOwners: mocks.accessibleOwners,
    });
    expect(result).toEqual(mocks.itemApi);
  });

  it('SHOULD propagate Forbidden (403)', async () => {
    mocks.createUseCase.execute.mockRejectedValueOnce(new ForbiddenException());

    await expect(setup.create(mocks.userId, body)).rejects.toThrow(ForbiddenException);
  });
});

describe('update', () => {
  it('SHOULD forward id and patch', async () => {
    const result = await setup.update(mocks.userId, mocks.itemApi.id, { notes: null, quantity: 1 });

    expect(mocks.updateUseCase.execute).toHaveBeenCalledWith({
      accessibleOwners: mocks.accessibleOwners,
      id: mocks.itemApi.id,
      notes: null,
      quantity: 1,
    });
    expect(result).toEqual(mocks.itemApi);
  });
});

describe('delete', () => {
  it('SHOULD call the use case with the accessible owners', async () => {
    await setup.delete(mocks.userId, mocks.itemApi.id);

    expect(mocks.deleteUseCase.execute).toHaveBeenCalledWith({
      accessibleOwners: mocks.accessibleOwners,
      id: mocks.itemApi.id,
    });
  });
});
