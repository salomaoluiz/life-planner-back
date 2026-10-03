import { mocks, setup } from './auth.service.mocks';

describe('AuthService', () => {
  describe('loginWithEmail', () => {
    it('SHOULD return the token WHEN login is successful', async () => {
      const result = await setup.loginWithEmail(mocks.inputs.login);

      expect(result).toEqual({ token: mocks.loginUseCaseResult.token });
    });

    it('SHOULD call LoginByEmailUseCase with correct parameters', async () => {
      await setup.loginWithEmail(mocks.inputs.login);

      expect(mocks.loginByEmailUseCase.execute).toHaveBeenCalledTimes(1);
      expect(mocks.loginByEmailUseCase.execute).toHaveBeenCalledWith({
        email: mocks.inputs.login.email,
        password: mocks.inputs.login.password,
      });
    });
  });

  describe('signUpWithEmail', () => {
    it('SHOULD execute successfully (resolve promise)', async () => {
      const service = setup;

      const result = await service.signUpWithEmail(mocks.inputs.signUp);

      expect(result).toBeUndefined();
    });

    it('SHOULD call SignUpByEmailUseCase with correct parameters', async () => {
      await setup.signUpWithEmail(mocks.inputs.signUp);

      expect(mocks.signUpByEmailUseCase.execute).toHaveBeenCalledTimes(1);
      expect(mocks.signUpByEmailUseCase.execute).toHaveBeenCalledWith({
        email: mocks.inputs.signUp.email,
        name: mocks.inputs.signUp.name,
        password: mocks.inputs.signUp.password,
        photoURL: mocks.inputs.signUp.photoURL,
      });
    });
  });
});
