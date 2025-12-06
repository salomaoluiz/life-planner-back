import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

import { Env } from './env.schema';

@Injectable()
export class EnvService {
  constructor(private readonly nestConfigService: NestConfigService<Env, true>) {}

  // App
  get environment(): Env['NODE_ENV'] {
    return this.nestConfigService.get('NODE_ENV');
  }

  get port(): Env['PORT'] {
    return this.nestConfigService.get('PORT');
  }

  // Database

  get databaseUrl(): Env['DATABASE_URL'] {
    return this.nestConfigService.get('DATABASE_URL');
  }

  // JWT

  get jwtExpiresIn(): Env['JWT_EXPIRES_IN'] {
    return this.nestConfigService.get('JWT_EXPIRES_IN');
  }

  get jwtSecret(): Env['JWT_SECRET'] {
    return this.nestConfigService.get('JWT_SECRET');
  }
}
