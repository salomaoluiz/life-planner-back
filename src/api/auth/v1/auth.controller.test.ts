import { HTTP_CODE_METADATA, VERSION_METADATA } from '@nestjs/common/constants';

import { IS_PUBLIC_KEY } from '@shared/infra/http/decorators/Public';

import { mocks, setup, spies } from './auth.controller.mocks';

describe('AuthController', () => {
  it('SHOULD be served under URI version 1', () => {
    expect(Reflect.getMetadata(VERSION_METADATA, setup.constructor)).toBe('1');
  });

  describe('POST login/email', () => {
    it('SHOULD return the token WHEN login is successful', async () => {
      const controller = setup;

      const result = await controller.loginWithEmail(mocks.inputs.login);

      expect(result).toEqual(mocks.authResult);
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

  describe('POST refresh', () => {
    it('SHOULD validate with the refresh schema AND return the service result', async () => {
      const result = await setup.refresh(mocks.inputs.refresh);

      expect(spies.validate).toHaveBeenCalledWith(mocks.schemas.refresh, mocks.inputs.refresh);
      expect(mocks.authService.refreshSession).toHaveBeenCalledWith(mocks.parsed.refresh);
      expect(result).toEqual(mocks.authResult);
    });

    it('SHOULD answer 200 AND be public', () => {
      expect(Reflect.getMetadata(HTTP_CODE_METADATA, Object.getPrototypeOf(setup).refresh)).toBe(
        200,
      );
      expect(Reflect.getMetadata(IS_PUBLIC_KEY, Object.getPrototypeOf(setup).refresh)).toBe(true);
    });
  });

  describe('POST logout', () => {
    it('SHOULD validate, call the service AND return nothing', async () => {
      const result = await setup.logout(mocks.inputs.refresh);

      expect(spies.validate).toHaveBeenCalledWith(mocks.schemas.refresh, mocks.inputs.refresh);
      expect(mocks.authService.logout).toHaveBeenCalledWith(mocks.parsed.refresh);
      expect(result).toBeUndefined();
    });

    it('SHOULD answer 204 AND be public', () => {
      expect(Reflect.getMetadata(HTTP_CODE_METADATA, Object.getPrototypeOf(setup).logout)).toBe(
        204,
      );
      expect(Reflect.getMetadata(IS_PUBLIC_KEY, Object.getPrototypeOf(setup).logout)).toBe(true);
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
