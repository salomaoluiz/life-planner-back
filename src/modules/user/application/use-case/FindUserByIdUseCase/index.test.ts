import { NotFoundException } from '@nestjs/common';

import { mocks, setup } from './index.mocks';

describe('FindUserByIdUseCase', () => {
  it('SHOULD return the user details WHEN user exists', async () => {
    const result = await setup.execute(mocks.input);

    expect(result).toEqual({
      email: mocks.userEntity.email,
      id: mocks.userEntity.id,
      name: mocks.userEntity.name,
      photoUrl: mocks.userEntity.photoUrl,
    });
  });

  it('SHOULD call userRepository.getUserById with correct ID', async () => {
    await setup.execute(mocks.input);

    expect(mocks.userRepository.getUserById).toHaveBeenCalledTimes(1);
    expect(mocks.userRepository.getUserById).toHaveBeenCalledWith(mocks.input.id);
  });

  it('SHOULD throw NotFoundException WHEN user does not exist', async () => {
    const useCase = setup;
    mocks.userRepository.getUserById.mockResolvedValueOnce(null);

    const promise = useCase.execute(mocks.input);

    await expect(promise).rejects.toThrow(NotFoundException);
  });
});
