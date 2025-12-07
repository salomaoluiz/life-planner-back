import { Global, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';

import { Database } from '@shared/infra/db/Database';

import { EnvModule } from './infra/env/env.module';
import { AllExceptionsFilter } from './infra/http/filters/all-exception-filter';
import { JwtAuthGuard } from './infra/http/guards/JwtAuthGuard';
import { NestJwtProvider } from './infra/jwt/nest';
import { Logger } from './infra/logger';
import { BcryptHasher } from './infra/password-hasher/bcrypt/BcryptHasher';

@Global()
@Module({
  exports: ['ILogger', 'IJwtProvider', 'IPasswordHasher', Database],
  imports: [EnvModule, JwtModule.register({})],
  providers: [
    Database,
    { provide: 'ILogger', useClass: Logger },
    { provide: 'IJwtProvider', useClass: NestJwtProvider },
    { provide: 'IPasswordHasher', useClass: BcryptHasher },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class SharedModule {}
