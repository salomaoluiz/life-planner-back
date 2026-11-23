import { Global, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';

import { Database } from '@shared/infra/db/Database';

import { BuildInfoReader } from './infra/build-info';
import { Embeddings } from './infra/embeddings';
import { EnvModule } from './infra/env/env.module';
import { GithubReleases } from './infra/github';
import { CacheControlInterceptor } from './infra/http/cache-control';
import { AllExceptionsFilter } from './infra/http/filters/all-exception-filter';
import { JwtAuthGuard } from './infra/http/guards/JwtAuthGuard';
import { NestJwtProvider } from './infra/jwt/nest';
import { Llm } from './infra/llm';
import { Logger } from './infra/logger';
import { BcbIndexes } from './infra/market-index/bcb';
import { PgNotifier } from './infra/notifier';
import { OpenFoodFacts } from './infra/open-food-facts';
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
    'IBcbIndexes',
    'IEmbeddings',
    'ILlm',
    'IOpenFoodFacts',
    'IScheduler',
    'INotifier',
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
    { provide: 'INotifier', useClass: PgNotifier },
    { provide: 'IBrapiQuotes', useClass: BrapiQuotes },
    { provide: 'IFinnhubQuotes', useClass: FinnhubQuotes },
    { provide: 'IFxRates', useClass: FxRates },
    { provide: 'IBcbIndexes', useClass: BcbIndexes },
    { provide: 'IEmbeddings', useClass: Embeddings },
    { provide: 'ILlm', useClass: Llm },
    { provide: 'IOpenFoodFacts', useClass: OpenFoodFacts },
    { provide: 'IScheduler', useClass: Scheduler },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_INTERCEPTOR, useClass: CacheControlInterceptor },
  ],
})
export class SharedModule {}
