import { mocks, setup } from './user.controller.mocks';

describe('UserController', () => {
  describe('findMe', () => {
    it('SHOULD return the current logged user', async () => {
      const result = await setup.findMe(mocks.request);

      expect(result).toEqual(mocks.user);
    });

    it('SHOULD call userService.findById with the ID from request', async () => {
      await setup.findMe(mocks.request);

      expect(mocks.userService.findById).toHaveBeenCalledTimes(1);
      expect(mocks.userService.findById).toHaveBeenCalledWith(mocks.request.user.id);
    });
  });

  describe('findById', () => {
    it('SHOULD return the user found by ID', async () => {
      const result = await setup.findById(mocks.user.id);

      expect(result).toEqual(mocks.user);
    });

    it('SHOULD call userService.findById with correct ID', async () => {
      await setup.findById(mocks.user.id);

      expect(mocks.userService.findById).toHaveBeenCalledTimes(1);
      expect(mocks.userService.findById).toHaveBeenCalledWith(mocks.user.id);
    });
  });

  describe('update', () => {
    it('SHOULD return the updated user', async () => {
      const result = await setup.update(mocks.user.id, mocks.updateUserInput);

      expect(result).toEqual(mocks.updatedUser);
    });

    it('SHOULD call userService.update with correct parameters', async () => {
      await setup.update(mocks.user.id, mocks.updateUserInput);

      expect(mocks.userService.update).toHaveBeenCalledTimes(1);
      expect(mocks.userService.update).toHaveBeenCalledWith(mocks.user.id, mocks.updateUserInput);
    });
  });
});
