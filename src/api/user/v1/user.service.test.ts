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

  describe('findMe', () => {
    it('SHOULD return the profile AND the families in the order the use case returned', async () => {
      const result = await setup.findMe(mocks.inputs.id);

      expect(result).toEqual({
        email: mocks.userResult.email,
        families: mocks.families.map(({ id, name, status }) => ({ id, name, status })),
        id: mocks.userResult.id,
        name: mocks.userResult.name,
        photoUrl: mocks.userResult.photoUrl,
      });
    });

    it('SHOULD return families: [] WHEN the user belongs to no family', async () => {
      mocks.getUserFamiliesUseCase.execute.mockResolvedValueOnce([]);

      const result = await setup.findMe(mocks.inputs.id);

      expect(result.families).toEqual([]);
    });

    it('SHOULD query the user and the families with the given user id only', async () => {
      await setup.findMe(mocks.inputs.id);

      expect(mocks.findUserByIdUseCase.execute).toHaveBeenCalledWith({ id: mocks.inputs.id });
      expect(mocks.getUserFamiliesUseCase.execute).toHaveBeenCalledTimes(1);
      expect(mocks.getUserFamiliesUseCase.execute).toHaveBeenCalledWith({
        userId: mocks.inputs.id,
      });
    });

    it('SHOULD NOT return passwordHash NOR extra family fields', async () => {
      mocks.getUserFamiliesUseCase.execute.mockResolvedValueOnce([
        { ...mocks.families[0], createdAt: new Date(), ownerId: 'owner-id' },
      ]);

      const result = await setup.findMe(mocks.inputs.id);

      expect(result).not.toHaveProperty('passwordHash');
      expect(Object.keys(result.families[0]).sort()).toEqual(['id', 'name', 'status']);
    });
  });

  describe('findById (no families)', () => {
    it('SHOULD NOT include families', async () => {
      const result = await setup.findById(mocks.inputs.id);

      expect(result).not.toHaveProperty('families');
      expect(mocks.getUserFamiliesUseCase.execute).not.toHaveBeenCalled();
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
