import { Global, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';

import { Database } from '@shared/infra/db/Database';

import { BuildInfoReader } from './infra/build-info';
import { EnvModule } from './infra/env/env.module';
import { GithubReleases } from './infra/github';
import { CacheControlInterceptor } from './infra/http/cache-control';
import { AllExceptionsFilter } from './infra/http/filters/all-exception-filter';
import { JwtAuthGuard } from './infra/http/guards/JwtAuthGuard';
import { NestJwtProvider } from './infra/jwt/nest';
import { Logger } from './infra/logger';
import { BcryptHasher } from './infra/password-hasher/bcrypt/BcryptHasher';
import { BrapiQuotes } from './infra/quotes/brapi';
import { FinnhubQuotes } from './infra/quotes/finnhub';
import { FxRates } from './infra/quotes/fx';
import { Scheduler } from './infra/scheduler';

@Global()
@Module({
  exports: [
    'ILogger',
    'IJwtProvider',
    'IPasswordHasher',
    'IGithubReleases',
    'IBuildInfo',
    'IBrapiQuotes',
    'IFinnhubQuotes',
    'IFxRates',
    'IScheduler',
    Database,
    EnvModule,
  ],
  imports: [EnvModule, JwtModule.register({}), ScheduleModule.forRoot()],
  providers: [
    Database,
    { provide: 'ILogger', useClass: Logger },
    { provide: 'IJwtProvider', useClass: NestJwtProvider },
    { provide: 'IPasswordHasher', useClass: BcryptHasher },
    { provide: 'IGithubReleases', useClass: GithubReleases },
    { provide: 'IBuildInfo', useClass: BuildInfoReader },
    { provide: 'IBrapiQuotes', useClass: BrapiQuotes },
    { provide: 'IFinnhubQuotes', useClass: FinnhubQuotes },
    { provide: 'IFxRates', useClass: FxRates },
    { provide: 'IScheduler', useClass: Scheduler },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_INTERCEPTOR, useClass: CacheControlInterceptor },
  ],
})
export class SharedModule {}
