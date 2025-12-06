import { Global, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';

import { EnvModule } from './infra/env/env.module';
import { AllExceptionsFilter } from './infra/http/filters/all-exception-filter';
import { JwtAuthGuard } from './infra/http/guards/JwtAuthGuard';
import { NestJwtProvider } from './infra/jwt/nest';
import { Logger } from './infra/logger';

@Global()
@Module({
  exports: ['ILogger', 'IJwtProvider'],
  imports: [EnvModule, JwtModule.register({})],
  providers: [
    { provide: 'ILogger', useClass: Logger },
    { provide: 'IJwtProvider', useClass: NestJwtProvider },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class SharedModule {}
