import { ForbiddenException, NotFoundException } from '@nestjs/common';

import { mocks, setup } from './index.mocks';

it('SHOULD return the family WHEN the user is the owner', async () => {
  const result = await setup.execute(mocks.ownerInput);

  expect(mocks.getFamilyByIdUseCase.execute).toHaveBeenCalledWith(mocks.ownerInput);
  expect(result).toBe(mocks.family);
});

it('SHOULD throw ForbiddenException WHEN the user is a member but NOT the owner', async () => {
  await expect(setup.execute(mocks.memberInput)).rejects.toThrow(ForbiddenException);
});

it('SHOULD propagate NotFoundException WHEN the user is NOT a member (404 wins over 403)', async () => {
  mocks.getFamilyByIdUseCase.execute.mockRejectedValueOnce(new NotFoundException());

  await expect(setup.execute(mocks.memberInput)).rejects.toThrow(NotFoundException);
});
