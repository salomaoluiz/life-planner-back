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

  get dbHost(): Env['DB_HOST'] {
    return this.nestConfigService.get('DB_HOST');
  }

  get dbName(): Env['DB_NAME'] {
    return this.nestConfigService.get('DB_NAME');
  }

  get dbPassword(): Env['DB_PASSWORD'] {
    return this.nestConfigService.get('DB_PASSWORD');
  }

  get dbPort(): Env['DB_PORT'] {
    return this.nestConfigService.get('DB_PORT');
  }

  get dbUser(): Env['DB_USER'] {
    return this.nestConfigService.get('DB_USER');
  }

  // JWT

  get jwtExpiresIn(): Env['JWT_EXPIRES_IN'] {
    return this.nestConfigService.get('JWT_EXPIRES_IN');
  }

  get jwtSecret(): Env['JWT_SECRET'] {
    return this.nestConfigService.get('JWT_SECRET');
  }
}
