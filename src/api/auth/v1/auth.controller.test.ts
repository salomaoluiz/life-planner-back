import { VERSION_METADATA } from '@nestjs/common/constants';

import { mocks, setup, spies } from './auth.controller.mocks';

describe('AuthController', () => {
  it('SHOULD be served under URI version 1', () => {
    expect(Reflect.getMetadata(VERSION_METADATA, setup.constructor)).toBe('1');
  });

  describe('POST login/email', () => {
    it('SHOULD return the token WHEN login is successful', async () => {
      const controller = setup;

      const result = await controller.loginWithEmail(mocks.inputs.login);

      expect(result).toEqual({ token: mocks.authResult.token });
    });

    it('SHOULD validate the input using the correct schema', async () => {
      const controller = setup;

      await controller.loginWithEmail(mocks.inputs.login);

      expect(spies.validate).toHaveBeenCalledTimes(1);
      expect(spies.validate).toHaveBeenCalledWith(mocks.schemas.login, mocks.inputs.login);
    });

    it('SHOULD call authService.loginWithEmail with the parsed (normalized) input', async () => {
      const controller = setup;

      await controller.loginWithEmail({ ...mocks.inputs.login, email: ' RAW@Example.com ' });

      expect(mocks.authService.loginWithEmail).toHaveBeenCalledTimes(1);
      expect(mocks.authService.loginWithEmail).toHaveBeenCalledWith(mocks.parsed.login);
    });
  });

  describe('POST signup/email', () => {
    it('SHOULD execute successfully (return void) WHEN signup is successful', async () => {
      const controller = setup;

      const result = await controller.signUpWithEmail(mocks.inputs.signUp);

      expect(result).toBeUndefined();
    });

    it('SHOULD validate the input using the correct schema', async () => {
      const controller = setup;

      await controller.signUpWithEmail(mocks.inputs.signUp);

      expect(spies.validate).toHaveBeenCalledTimes(1);
      expect(spies.validate).toHaveBeenCalledWith(mocks.schemas.signUp, mocks.inputs.signUp);
    });

    it('SHOULD call authService.signUpWithEmail with the parsed (normalized) input', async () => {
      const controller = setup;

      await controller.signUpWithEmail({ ...mocks.inputs.signUp, email: ' RAW@Example.com ' });

      expect(mocks.authService.signUpWithEmail).toHaveBeenCalledTimes(1);
      expect(mocks.authService.signUpWithEmail).toHaveBeenCalledWith(mocks.parsed.signUp);
    });
  });
});
