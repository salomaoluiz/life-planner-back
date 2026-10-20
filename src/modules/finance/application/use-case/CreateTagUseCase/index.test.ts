import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import { OwnerType } from '@shared/domain/entity/owner/OwnerEntity';

import { mocks, setup } from './index.mocks';

describe('CreateTagUseCase', () => {
  it('SHOULD create a single-scope tag with the trimmed name', async () => {
    const result = await setup.execute({
      accessibleOwners: mocks.accessibleOwners,
      name: '  gasto-fixo  ',
      owner: mocks.family.owner,
      ownerId: mocks.family.ownerId,
    });

    expect(result).toBe(mocks.tag);
    expect(mocks.tagRepository.findConflictingScopes).toHaveBeenCalledWith({
      name: 'gasto-fixo',
      scopes: [mocks.family],
    });
    expect(mocks.tagRepository.createTag).toHaveBeenCalledWith({
      allScopes: undefined,
      creatorId: mocks.family.ownerId,
      name: 'gasto-fixo',
      owner: 'FAMILY',
      ownerId: mocks.family.ownerId,
      scopes: undefined,
    });
  });

  it('SHOULD create an ALL tag over every accessible scope, owned by the caller', async () => {
    await setup.execute({
      accessibleOwners: mocks.accessibleOwners,
      callerId: mocks.personal.ownerId,
      name: 'gasto-fixo',
      owner: 'ALL',
    });

    expect(mocks.tagRepository.createTag).toHaveBeenCalledWith({
      allScopes: true,
      creatorId: mocks.personal.ownerId,
      name: 'gasto-fixo',
      owner: 'USER',
      ownerId: mocks.personal.ownerId,
      scopes: mocks.accessibleOwners,
    });
  });

  it('SHOULD answer 409 naming the conflicting scope WHEN the name is in use', async () => {
    mocks.tagRepository.findConflictingScopes.mockResolvedValue([mocks.personal]);

    const error = await setup
      .execute({
        accessibleOwners: mocks.accessibleOwners,
        name: 'Gasto-Fixo',
        owner: mocks.personal.owner,
        ownerId: mocks.personal.ownerId,
      })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getResponse()).toEqual({
      message: 'Tag name already in use',
      scope: mocks.personal,
    });
    expect(mocks.tagRepository.createTag).not.toHaveBeenCalled();
  });

  it('SHOULD answer 404 WHEN the owner is not accessible', async () => {
    await expect(
      setup.execute({
        accessibleOwners: mocks.accessibleOwners,
        name: 'x',
        owner: OwnerType.FAMILY,
        ownerId: 'stranger',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('SHOULD answer 422 WHEN the family is archived', async () => {
    await expect(
      setup.execute({
        accessibleOwners: mocks.accessibleOwners,
        name: 'x',
        owner: OwnerType.FAMILY,
        ownerId: mocks.archivedFamily.ownerId,
      }),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it.each(['', '   ', 'x'.repeat(31)])('SHOULD reject the name %j', async (name) => {
    await expect(
      setup.execute({
        accessibleOwners: mocks.accessibleOwners,
        name,
        owner: OwnerType.USER,
        ownerId: mocks.personal.ownerId,
      }),
    ).rejects.toThrow();
  });
});
