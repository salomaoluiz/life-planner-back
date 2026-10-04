import { ForbiddenException, NotFoundException } from '@nestjs/common';

import { mocks, setup } from './index.mocks';

it('SHOULD check the owner AND delete the family', async () => {
  await setup.execute(mocks.input);

  expect(mocks.ensureFamilyOwnerUseCase.execute).toHaveBeenCalledWith(mocks.input);
  expect(mocks.familyRepository.deleteFamily).toHaveBeenCalledWith(mocks.input.familyId);
});

it.each([
  ['unknown or non-member (404)', new NotFoundException()],
  ['non-owner (403)', new ForbiddenException()],
])('SHOULD NOT delete WHEN the caller is %s', async (_label, error) => {
  mocks.ensureFamilyOwnerUseCase.execute.mockRejectedValueOnce(error);

  await expect(setup.execute(mocks.input)).rejects.toThrow(error);
  expect(mocks.familyRepository.deleteFamily).not.toHaveBeenCalled();
});
