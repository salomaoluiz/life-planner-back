import { Inject, UnauthorizedException } from '@nestjs/common';

import { UseCaseWithParams } from '@shared/application/use-case/types';
import { IJwtProvider } from '@shared/infra/jwt/types';
import { validate } from '@shared/infra/validation';
import {
  LoginByEmailInput,
  LoginByEmailOutput,
  LoginByEmailSchema,
} from '@user/application/dto/LoginByEmail';
import { IUserRepository } from '@user/domain/repository';
import { IPasswordHasherRepository } from '@user/domain/repository/IPasswordHasherRepository';

export class LoginByEmailUseCase implements UseCaseWithParams<
  LoginByEmailInput,
  LoginByEmailOutput
> {
  constructor(
    @Inject('IUserRepository') private readonly userRepository: IUserRepository,
    @Inject('IPasswordHasherRepository') private readonly passwordHasher: IPasswordHasherRepository,
    @Inject('IJwtProvider') private readonly jwtProvider: IJwtProvider,
  ) {}

  async execute(params: LoginByEmailInput): Promise<LoginByEmailOutput> {
    validate(LoginByEmailSchema, params);
    const user = await this.userRepository.getUserByEmail(params.email);

    if (!user) {
      throw new UnauthorizedException('Invalid Credentials');
    }

    const isEqual = await this.passwordHasher.compare(params.password, user.passwordHash);

    if (!isEqual) {
      throw new UnauthorizedException('Invalid Credentials');
    }

    const token = await this.jwtProvider.sign({
      user: {
        id: user.id,
      },
    });

    return {
      token,
    };
  }
}
