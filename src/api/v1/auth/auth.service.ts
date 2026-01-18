import { Injectable } from '@nestjs/common';

import { LoginWithEmailApiInput, LoginWithEmailApiOutput } from '@api/v1/auth/dto/login.dto';
import { SignUpWithEmailApiInput, SignUpWithEmailApiOutput } from '@api/v1/auth/dto/signup.dto';
import { LoginByEmailUseCase } from '@user/application/use-cases/LoginByEmailUseCase';
import { SignUpByEmailUseCase } from '@user/application/use-cases/SignUpByEmailUseCase';

@Injectable()
export class AuthService {
  constructor(
    private readonly loginByEmailUseCase: LoginByEmailUseCase,
    private readonly signUpByEmailUseCase: SignUpByEmailUseCase,
  ) {}

  async loginWithEmail(params: LoginWithEmailApiInput): Promise<LoginWithEmailApiOutput> {
    const result = await this.loginByEmailUseCase.execute({
      email: params.email,
      password: params.password,
    });

    return { token: result.token };
  }

  async signUpWithEmail(params: SignUpWithEmailApiInput): Promise<SignUpWithEmailApiOutput> {
    await this.signUpByEmailUseCase.execute({
      email: params.email,
      name: params.name,
      password: params.password,
      photoURL: params.photoURL,
    });
  }
}
