import { Inject, Injectable } from '@nestjs/common';

import { LoginWithEmailApiInput, LoginWithEmailApiOutput } from '@api/auth/v1/dto/login.dto';
import { RefreshApiInput } from '@api/auth/v1/dto/refresh.dto';
import { SignUpWithEmailApiInput, SignUpWithEmailApiOutput } from '@api/auth/v1/dto/signup.dto';
import { ILogger, LogLevel } from '@shared/infra/logger/types';
import { LoginByEmailUseCase } from '@user/application/use-case/LoginByEmailUseCase';
import { PurgeExpiredSessionsUseCase } from '@user/application/use-case/PurgeExpiredSessionsUseCase';
import { RefreshSessionUseCase } from '@user/application/use-case/RefreshSessionUseCase';
import { RevokeSessionUseCase } from '@user/application/use-case/RevokeSessionUseCase';
import { SignUpByEmailUseCase } from '@user/application/use-case/SignUpByEmailUseCase';

@Injectable()
export class AuthService {
  constructor(
    private readonly loginByEmailUseCase: LoginByEmailUseCase,
    private readonly purgeExpiredSessionsUseCase: PurgeExpiredSessionsUseCase,
    private readonly refreshSessionUseCase: RefreshSessionUseCase,
    private readonly revokeSessionUseCase: RevokeSessionUseCase,
    private readonly signUpByEmailUseCase: SignUpByEmailUseCase,
    @Inject('ILogger') private readonly logger: ILogger,
  ) {}

  async loginWithEmail(params: LoginWithEmailApiInput): Promise<LoginWithEmailApiOutput> {
    const result = await this.loginByEmailUseCase.execute({
      deviceName: params.deviceName,
      email: params.email,
      password: params.password,
    });
    await this.purgeExpiredSessions();

    return result;
  }

  async logout(params: RefreshApiInput): Promise<void> {
    await this.revokeSessionUseCase.execute({ refreshToken: params.refreshToken });
  }

  async refreshSession(params: RefreshApiInput): Promise<LoginWithEmailApiOutput> {
    try {
      return await this.refreshSessionUseCase.execute({ refreshToken: params.refreshToken });
    } finally {
      await this.purgeExpiredSessions();
    }
  }

  async signUpWithEmail(params: SignUpWithEmailApiInput): Promise<SignUpWithEmailApiOutput> {
    await this.signUpByEmailUseCase.execute({
      email: params.email,
      name: params.name,
      password: params.password,
      photoURL: params.photoURL,
    });
  }

  // A failed purge must never fail the login/refresh that triggered it.
  private async purgeExpiredSessions(): Promise<void> {
    try {
      await this.purgeExpiredSessionsUseCase.execute();
    } catch (error: unknown) {
      this.logger.log(LogLevel.ERROR, 'Purge of expired sessions failed', {
        error: error instanceof Error ? error.message : String(error),
        module: 'AuthService',
      });
    }
  }
}
