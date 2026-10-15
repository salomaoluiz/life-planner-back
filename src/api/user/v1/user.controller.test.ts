import { HTTP_CODE_METADATA, VERSION_METADATA } from '@nestjs/common/constants';

import { ValidationError } from '@shared/domain/error/ValidationError';

import { UserController } from './user.controller';
import { mocks, setup } from './user.controller.mocks';

describe('UserController', () => {
  it('SHOULD be served under URI version 1', () => {
    expect(Reflect.getMetadata(VERSION_METADATA, setup.constructor)).toBe('1');
  });

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

  describe('deleteMe', () => {
    it('SHOULD call the service with the TOKEN user id and the validated email', async () => {
      await setup.deleteMe(mocks.request, { email: ' Test@Example.com ' });

      expect(mocks.accountDeletionService.deleteAccount).toHaveBeenCalledWith(
        mocks.request.user.id,
        { email: 'test@example.com' },
      );
    });

    it('SHOULD ignore an id/userId sent in the body (the target is still the token user)', async () => {
      await setup.deleteMe(mocks.request, {
        email: 'test@example.com',
        id: 'another-user',
        userId: 'another-user',
      } as never);

      expect(mocks.accountDeletionService.deleteAccount).toHaveBeenCalledWith(
        mocks.request.user.id,
        { email: 'test@example.com' },
      );
    });

    it.each([
      undefined,
      {},
      { email: 'not-an-email' },
      { email: '' },
      { email: `${'a'.repeat(250)}@example.com` },
    ])(
      'SHOULD throw ValidationError (400) AND delete nothing WHEN the body is %p',
      async (body) => {
        await expect(setup.deleteMe(mocks.request, body as never)).rejects.toThrow(ValidationError);
        expect(mocks.accountDeletionService.deleteAccount).not.toHaveBeenCalled();
      },
    );

    it('SHOULD answer 204 No Content', () => {
      expect(Reflect.getMetadata(HTTP_CODE_METADATA, UserController.prototype.deleteMe)).toBe(204);
    });
  });
});
