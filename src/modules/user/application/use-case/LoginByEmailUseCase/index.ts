import { Inject, UnauthorizedException } from '@nestjs/common';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { EnvService } from '@shared/infra/env/env.service';
import { IJwtProvider } from '@shared/infra/jwt/types';
import { generateToken, hashToken } from '@shared/infra/token';
import { validate } from '@shared/infra/validation';
import {
  LoginByEmailInput,
  LoginByEmailOutput,
  LoginByEmailSchema,
} from '@user/application/dto/LoginByEmail';
import UserSessionEntity from '@user/domain/entity/UserSessionEntity';
import { IUserRepository, IUserSessionRepository } from '@user/domain/repository';
import { IPasswordHasherRepository } from '@user/domain/repository/IPasswordHasherRepository';

export class LoginByEmailUseCase implements UseCaseWithParams<
  LoginByEmailInput,
  LoginByEmailOutput
> {
  constructor(
    @Inject('IUserRepository') private readonly userRepository: IUserRepository,
    @Inject('IPasswordHasherRepository') private readonly passwordHasher: IPasswordHasherRepository,
    @Inject('IJwtProvider') private readonly jwtProvider: IJwtProvider,
    @Inject('IUserSessionRepository') private readonly sessionRepository: IUserSessionRepository,
    @Inject(EnvService) private readonly env: EnvService,
  ) {}

  async execute(params: LoginByEmailInput): Promise<LoginByEmailOutput> {
    const input = validate(LoginByEmailSchema, params);
    const user = await this.userRepository.getUserByEmail(input.email);

    if (!user) {
      throw new UnauthorizedException('Invalid Credentials');
    }

    const isEqual = await this.passwordHasher.compare(input.password, user.passwordHash ?? '');

    if (!isEqual) {
      throw new UnauthorizedException('Invalid Credentials');
    }

    const refreshToken = generateToken();
    await this.sessionRepository.createSession(
      new UserSessionEntity({
        deviceName: input.deviceName?.length ? input.deviceName : undefined,
        tokenHash: hashToken(refreshToken),
        userId: user.id,
      }),
    );

    const token = await this.jwtProvider.sign({
      user: {
        id: user.id,
      },
    });

    return {
      refreshToken,
      refreshTokenExpiresIn: this.env.sessionIdleTtlSeconds,
      token,
    };
  }
}
