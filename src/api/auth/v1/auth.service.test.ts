import { UnauthorizedException } from '@nestjs/common';

import { LogLevel } from '@shared/infra/logger/types';

import { mocks, setup } from './auth.service.mocks';

describe('AuthService', () => {
  describe('loginWithEmail', () => {
    it('SHOULD return the full token pair WHEN login is successful', async () => {
      const result = await setup.loginWithEmail(mocks.inputs.login);

      expect(result).toEqual(mocks.loginUseCaseResult);
    });

    it('SHOULD call LoginByEmailUseCase with correct parameters (deviceName included)', async () => {
      await setup.loginWithEmail({ ...mocks.inputs.login, deviceName: 'iPhone' });

      expect(mocks.loginByEmailUseCase.execute).toHaveBeenCalledTimes(1);
      expect(mocks.loginByEmailUseCase.execute).toHaveBeenCalledWith({
        deviceName: 'iPhone',
        email: mocks.inputs.login.email,
        password: mocks.inputs.login.password,
      });
    });

    it('SHOULD purge expired sessions after a successful login', async () => {
      await setup.loginWithEmail(mocks.inputs.login);

      expect(mocks.purgeExpiredSessionsUseCase.execute).toHaveBeenCalledTimes(1);
    });

    it('SHOULD NOT purge WHEN login fails', async () => {
      mocks.loginByEmailUseCase.execute.mockRejectedValueOnce(new UnauthorizedException('x'));

      await expect(setup.loginWithEmail(mocks.inputs.login)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(mocks.purgeExpiredSessionsUseCase.execute).not.toHaveBeenCalled();
    });

    it('SHOULD log AND swallow a purge failure (login still succeeds, token not logged)', async () => {
      mocks.purgeExpiredSessionsUseCase.execute.mockRejectedValueOnce(new Error('db down'));

      await expect(setup.loginWithEmail(mocks.inputs.login)).resolves.toEqual(
        mocks.loginUseCaseResult,
      );
      expect(mocks.logger.log).toHaveBeenCalledWith(
        LogLevel.ERROR,
        'Purge of expired sessions failed',
        { error: 'db down', module: 'AuthService' },
      );
    });
  });

  describe('refreshSession', () => {
    it('SHOULD return the new pair AND purge afterwards', async () => {
      const result = await setup.refreshSession(mocks.inputs.refresh);

      expect(result).toEqual(mocks.loginUseCaseResult);
      expect(mocks.refreshSessionUseCase.execute).toHaveBeenCalledWith(mocks.inputs.refresh);
      expect(mocks.purgeExpiredSessionsUseCase.execute).toHaveBeenCalledTimes(1);
    });

    it('SHOULD purge also WHEN the refresh fails, and rethrow the refresh error', async () => {
      mocks.refreshSessionUseCase.execute.mockRejectedValueOnce(new UnauthorizedException('x'));

      await expect(setup.refreshSession(mocks.inputs.refresh)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(mocks.purgeExpiredSessionsUseCase.execute).toHaveBeenCalledTimes(1);
    });

    it('SHOULD swallow a purge failure after a failed refresh AND keep the refresh error', async () => {
      mocks.refreshSessionUseCase.execute.mockRejectedValueOnce(new UnauthorizedException('x'));
      mocks.purgeExpiredSessionsUseCase.execute.mockRejectedValueOnce(new Error('db down'));

      await expect(setup.refreshSession(mocks.inputs.refresh)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(JSON.stringify(mocks.logger.log.mock.calls)).not.toContain(
        mocks.inputs.refresh.refreshToken,
      );
    });
  });

  describe('logout', () => {
    it('SHOULD revoke the session', async () => {
      await expect(setup.logout(mocks.inputs.refresh)).resolves.toBeUndefined();

      expect(mocks.revokeSessionUseCase.execute).toHaveBeenCalledWith(mocks.inputs.refresh);
    });
  });

  describe('signUpWithEmail', () => {
    it('SHOULD execute successfully (resolve promise)', async () => {
      const result = await setup.signUpWithEmail(mocks.inputs.signUp);

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
