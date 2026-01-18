import { NotFoundException } from '@nestjs/common';

import { mocks, setup, spies } from './index.mocks';

describe('UpdateUserUseCase', () => {
  it('SHOULD return the updated user data WHEN update is successful', async () => {
    const result = await setup.execute(mocks.inputs.fullUpdate);

    expect(result).toEqual({
      email: mocks.updatedUserEntity.email,
      id: mocks.updatedUserEntity.id,
      name: mocks.updatedUserEntity.name,
      photoUrl: mocks.updatedUserEntity.photoUrl,
    });
  });

  it('SHOULD verify if user exists before updating', async () => {
    await setup.execute(mocks.inputs.fullUpdate);

    expect(mocks.userRepository.getUserById).toHaveBeenCalledTimes(1);
    expect(mocks.userRepository.getUserById).toHaveBeenCalledWith(mocks.inputs.fullUpdate.id);
  });

  it('SHOULD throw NotFoundException WHEN user does not exist', async () => {
    const useCase = setup;
    mocks.userRepository.getUserById.mockResolvedValueOnce(null);

    const promise = useCase.execute(mocks.inputs.fullUpdate);

    await expect(promise).rejects.toThrow(NotFoundException);
  });

  it('SHOULD create a new UserEntity instance with updated values AND call repository', async () => {
    await setup.execute(mocks.inputs.fullUpdate);

    expect(spies.userEntity).toHaveBeenCalledTimes(1);
    expect(spies.userEntity).toHaveBeenCalledWith({
      email: mocks.inputs.fullUpdate.email,
      id: mocks.inputs.fullUpdate.id,
      name: mocks.inputs.fullUpdate.name,
      passwordHash: mocks.existingUser.passwordHash,
      photoUrl: mocks.inputs.fullUpdate.photoUrl,
    });

    expect(mocks.userRepository.updateUser).toHaveBeenCalledTimes(1);
    // The spy implementation returns existingUserMock, checking if repo is called with the result of new UserEntity()
    expect(mocks.userRepository.updateUser).toHaveBeenCalledWith(mocks.existingUser);
  });

  it('SHOULD use existing user values WHEN input fields are null/undefined (partial update)', async () => {
    await setup.execute(mocks.inputs.partialUpdate);

    expect(spies.userEntity).toHaveBeenCalledWith(
      expect.objectContaining({
        email: mocks.existingUser.email, // Should keep original
        id: mocks.inputs.partialUpdate.id,
        name: mocks.inputs.partialUpdate.name, // Should update
        passwordHash: mocks.existingUser.passwordHash,
        photoUrl: mocks.existingUser.photoUrl, // Should keep original
      }),
    );
  });
});
