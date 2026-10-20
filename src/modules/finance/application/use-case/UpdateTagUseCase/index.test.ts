import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';

import { mocks, setup } from './index.mocks';

function base() {
  return { accessibleOwners: mocks.accessibleOwners, id: mocks.tag.id };
}

describe('UpdateTagUseCase', () => {
  it('SHOULD rename AND check the new name against the tag scopes, excluding itself', async () => {
    await setup.execute({ ...base(), name: ' Novo ' });

    expect(mocks.tagRepository.findConflictingScopes).toHaveBeenCalledWith({
      excludeId: mocks.tag.id,
      name: 'Novo',
      scopes: mocks.tag.scopes,
    });
    expect(mocks.tagRepository.updateTag).toHaveBeenCalledWith({
      id: mocks.tag.id,
      name: 'Novo',
      scope: undefined,
    });
  });

  it('SHOULD answer 409 WHEN the new name is in use in a scope', async () => {
    mocks.tagRepository.findConflictingScopes.mockResolvedValue([mocks.personal]);

    await expect(setup.execute({ ...base(), name: 'Novo' })).rejects.toThrow(ConflictException);
    expect(mocks.tagRepository.updateTag).not.toHaveBeenCalled();
  });

  it('SHOULD switch to ALL over every accessible scope, checking the name in all of them', async () => {
    await setup.execute({ ...base(), callerId: mocks.personal.ownerId, scope: 'ALL' });

    expect(mocks.tagRepository.findConflictingScopes).toHaveBeenCalledWith({
      excludeId: mocks.tag.id,
      name: 'gasto',
      scopes: mocks.accessibleOwners,
    });
    expect(mocks.tagRepository.updateTag).toHaveBeenCalledWith({
      id: mocks.tag.id,
      name: undefined,
      scope: { creatorId: mocks.personal.ownerId, scopes: mocks.accessibleOwners },
    });
  });

  it('SHOULD be a no-op WHEN the tag is already ALL and nothing else changes', async () => {
    const allTag = { ...mocks.tag, allScopes: true };
    mocks.tagRepository.findTagById.mockResolvedValue(allTag);

    expect(await setup.execute({ ...base(), callerId: 'x', scope: 'ALL' })).toBe(allTag);
    expect(mocks.tagRepository.updateTag).not.toHaveBeenCalled();
  });

  it('SHOULD answer 403 WHEN switching to ALL without a caller', async () => {
    await expect(setup.execute({ ...base(), scope: 'ALL' })).rejects.toThrow(ForbiddenException);
  });

  it('SHOULD answer 404 WHEN the tag is missing or not visible', async () => {
    mocks.tagRepository.findTagById.mockResolvedValueOnce(undefined);

    await expect(setup.execute({ ...base(), name: 'x' })).rejects.toThrow(NotFoundException);
    await expect(
      setup.execute({ accessibleOwners: [mocks.family], id: mocks.tag.id, name: 'x' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('SHOULD reject an empty update', async () => {
    await expect(setup.execute(base())).rejects.toThrow();
  });
});
