import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';

import {
  LoginWithEmailApiInput,
  LoginWithEmailApiOutput,
  LoginWithEmailApiSchema,
} from '@api/auth/v1/dto/login.dto';
import { RefreshApiInput, RefreshApiSchema } from '@api/auth/v1/dto/refresh.dto';
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
    const input = validate(LoginWithEmailApiSchema, login);

    return this.authService.loginWithEmail(input);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  @Public()
  async logout(@Body() body: RefreshApiInput): Promise<void> {
    const input = validate(RefreshApiSchema, body);

    await this.authService.logout(input);
  }

  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  @Public()
  async refresh(@Body() body: RefreshApiInput): Promise<LoginWithEmailApiOutput> {
    const input = validate(RefreshApiSchema, body);

    return this.authService.refreshSession(input);
  }

  @Post('signup/email')
  @Public()
  async signUpWithEmail(
    @Body() signUp: SignUpWithEmailApiInput,
  ): Promise<SignUpWithEmailApiOutput> {
    const input = validate(SignUpWithEmailApiSchema, signUp);

    await this.authService.signUpWithEmail(input);
  }
}
