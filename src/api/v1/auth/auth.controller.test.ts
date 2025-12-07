import { mocks, setup, spies } from './auth.controller.mocks';

describe('AuthController', () => {
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

    it('SHOULD call authService.loginWithEmail with correct parameters', async () => {
      const controller = setup;

      await controller.loginWithEmail(mocks.inputs.login);

      expect(mocks.authService.loginWithEmail).toHaveBeenCalledTimes(1);
      expect(mocks.authService.loginWithEmail).toHaveBeenCalledWith(mocks.inputs.login);
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

    it('SHOULD call authService.signUpWithEmail with correct parameters', async () => {
      const controller = setup;

      await controller.signUpWithEmail(mocks.inputs.signUp);

      expect(mocks.authService.signUpWithEmail).toHaveBeenCalledTimes(1);
      expect(mocks.authService.signUpWithEmail).toHaveBeenCalledWith(mocks.inputs.signUp);
    });
  });
});
