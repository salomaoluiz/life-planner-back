import { NotFoundException } from '@nestjs/common';

import { mocks, setup } from './index.mocks';

it('SHOULD return the family WHEN the user is a member', async () => {
  const result = await setup.execute(mocks.input);

  expect(mocks.familyRepository.isFamilyMember).toHaveBeenCalledWith(mocks.input);
  expect(result).toEqual({
    createdAt: mocks.family.createdAt,
    id: mocks.family.id,
    name: mocks.family.name,
    ownerId: mocks.family.ownerId,
    updatedAt: mocks.family.updatedAt,
  });
});

it('SHOULD throw NotFoundException WHEN the user is NOT a member AND NOT read the family', async () => {
  mocks.familyRepository.isFamilyMember.mockResolvedValueOnce(false);

  await expect(setup.execute(mocks.input)).rejects.toThrow(NotFoundException);
  expect(mocks.familyRepository.getFamilyById).not.toHaveBeenCalled();
});

it('SHOULD throw NotFoundException WHEN the family vanished between the checks', async () => {
  mocks.familyRepository.getFamilyById.mockResolvedValueOnce(undefined);

  await expect(setup.execute(mocks.input)).rejects.toThrow(NotFoundException);
});
