import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { EnvService } from '@shared/infra/env/env.service';
import { IJwtProvider, JwtUserPayload } from '@shared/infra/jwt/types';
import { ILogger, LogLevel } from '@shared/infra/logger/types';

@Injectable()
export class NestJwtProvider implements IJwtProvider {
  constructor(
    private readonly env: EnvService,
    @Inject('ILogger') private readonly logger: ILogger,
    private readonly jwtService: JwtService,
  ) {}

  async sign(payload: JwtUserPayload): Promise<string> {
    return this.jwtService.signAsync(payload, {
      expiresIn: this.env.jwtExpiresIn,
      secret: this.env.jwtSecret,
    });
  }

  async verify<T = NestJwtProvider>(token: string): Promise<JwtUserPayload & T> {
    try {
      return this.jwtService.verifyAsync<JwtUserPayload & T>(token, {
        secret: this.env.jwtSecret,
      });
    } catch (error: unknown) {
      this.logger.log(LogLevel.ERROR, 'JWT Verification failed', {
        error: error instanceof Error ? error.message : String(error),
        module: 'NestJwtProvider',
      });
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
