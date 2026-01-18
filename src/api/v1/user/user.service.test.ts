import { mocks, setup } from './user.service.mocks';

describe('UserService', () => {
  describe('findById', () => {
    it('SHOULD return the user details', async () => {
      const result = await setup.findById(mocks.inputs.id);

      expect(result).toEqual({
        email: mocks.userResult.email,
        id: mocks.userResult.id,
        name: mocks.userResult.name,
        photoUrl: mocks.userResult.photoUrl,
      });
    });

    it('SHOULD call findUserByIdUseCase.execute with correct ID', async () => {
      await setup.findById(mocks.inputs.id);

      expect(mocks.findUserByIdUseCase.execute).toHaveBeenCalledTimes(1);
      expect(mocks.findUserByIdUseCase.execute).toHaveBeenCalledWith({
        id: mocks.inputs.id,
      });
    });
  });

  describe('update', () => {
    it('SHOULD return the updated user details', async () => {
      const result = await setup.update(mocks.inputs.id, mocks.inputs.update);

      expect(result).toEqual({
        email: mocks.updatedUserResult.email,
        id: mocks.updatedUserResult.id,
        name: mocks.updatedUserResult.name,
        photoUrl: mocks.updatedUserResult.photoUrl,
      });
    });

    it('SHOULD call updateUserUseCase.execute with correct parameters', async () => {
      await setup.update(mocks.inputs.id, mocks.inputs.update);

      expect(mocks.updateUserUseCase.execute).toHaveBeenCalledTimes(1);
      expect(mocks.updateUserUseCase.execute).toHaveBeenCalledWith({
        email: mocks.inputs.update.email,
        id: mocks.inputs.id,
        name: mocks.inputs.update.name,
        photoUrl: mocks.inputs.update.photoUrl,
      });
    });
  });
});
