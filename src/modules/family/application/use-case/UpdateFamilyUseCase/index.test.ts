import { ForbiddenException, NotFoundException } from '@nestjs/common';

import { FamilyStatus } from '@family/domain/enum';
import { ValidationError } from '@shared/domain/error/ValidationError';

import { mocks, setup } from './index.mocks';

it('SHOULD check the owner, rename the family AND return it', async () => {
  const result = await setup.execute(mocks.input);

  expect(mocks.ensureFamilyOwnerUseCase.execute).toHaveBeenCalledWith({
    familyId: mocks.input.familyId,
    userId: mocks.input.userId,
  });
  expect(mocks.familyRepository.updateFamily).toHaveBeenCalledWith({
    id: mocks.input.familyId,
    name: 'Renamed Family',
  });
  expect(result.name).toBe(mocks.renamed.name);
  expect(result.updatedAt).toBe(mocks.renamed.updatedAt);
});

it('SHOULD trim the new name', async () => {
  await setup.execute({ ...mocks.input, name: '  Renamed Family ' });

  expect(mocks.familyRepository.updateFamily).toHaveBeenCalledWith(
    expect.objectContaining({ name: 'Renamed Family' }),
  );
});

it.each([
  ['empty', ''],
  ['whitespace-only', '  '],
  ['51 characters', 'a'.repeat(51)],
])('SHOULD throw ValidationError WHEN the name is %s', async (_label, name) => {
  await expect(setup.execute({ ...mocks.input, name })).rejects.toThrow(ValidationError);
  expect(mocks.familyRepository.updateFamily).not.toHaveBeenCalled();
});

it.each([
  ['non-member (404)', new NotFoundException()],
  ['non-owner (403)', new ForbiddenException()],
])('SHOULD NOT update WHEN the caller is a %s', async (_label, error) => {
  mocks.ensureFamilyOwnerUseCase.execute.mockRejectedValueOnce(error);

  await expect(setup.execute(mocks.input)).rejects.toThrow(error);
  expect(mocks.familyRepository.updateFamily).not.toHaveBeenCalled();
});

describe('archived family (spec 042)', () => {
  it('SHOULD refuse (422) a rename', async () => {
    mocks.ensureFamilyOwnerUseCase.execute.mockResolvedValueOnce({
      ...mocks.family,
      status: FamilyStatus.ARCHIVED,
    });

    await expect(setup.execute(mocks.input)).rejects.toMatchObject({
      message: 'Family is archived',
      status: 422,
    });
    expect(mocks.familyRepository.updateFamily).not.toHaveBeenCalled();
  });

  it('SHOULD allow reactivating (status only) AND pass the status to the repository', async () => {
    mocks.ensureFamilyOwnerUseCase.execute.mockResolvedValueOnce({
      ...mocks.family,
      status: FamilyStatus.ARCHIVED,
    });

    await setup.execute({
      familyId: mocks.input.familyId,
      status: FamilyStatus.ACTIVE,
      userId: mocks.input.userId,
    });

    expect(mocks.familyRepository.updateFamily).toHaveBeenCalledWith({
      id: mocks.input.familyId,
      name: undefined,
      status: FamilyStatus.ACTIVE,
    });
  });
});
