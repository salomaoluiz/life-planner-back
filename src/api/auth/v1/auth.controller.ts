import { Body, Controller, Post } from '@nestjs/common';

import {
  LoginWithEmailApiInput,
  LoginWithEmailApiOutput,
  LoginWithEmailApiSchema,
} from '@api/auth/v1/dto/login.dto';
import {
  SignUpWithEmailApiInput,
  SignUpWithEmailApiOutput,
  SignUpWithEmailApiSchema,
} from '@api/auth/v1/dto/signup.dto';
import { Public } from '@shared/infra/http/decorators/Public';
import { validate } from '@shared/infra/validation';

import { AuthService } from './auth.service';

@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login/email')
  @Public()
  async loginWithEmail(@Body() login: LoginWithEmailApiInput): Promise<LoginWithEmailApiOutput> {
    validate(LoginWithEmailApiSchema, login);

    const result = await this.authService.loginWithEmail(login);

    return { token: result.token };
  }

  @Post('signup/email')
  @Public()
  async signUpWithEmail(
    @Body() signUp: SignUpWithEmailApiInput,
  ): Promise<SignUpWithEmailApiOutput> {
    validate(SignUpWithEmailApiSchema, signUp);

    await this.authService.signUpWithEmail(signUp);
  }
}
