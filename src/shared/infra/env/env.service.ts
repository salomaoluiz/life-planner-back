import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

import { Env } from './env.schema';

@Injectable()
export class EnvService {
  constructor(private readonly nestConfigService: NestConfigService<Env, true>) {}

  // App
  get appEnvironment(): Env['APP_ENVIRONMENT'] {
    return this.nestConfigService.get('APP_ENVIRONMENT');
  }

  get corsOrigins(): Env['CORS_ORIGINS'] {
    return this.nestConfigService.get('CORS_ORIGINS');
  }

  get environment(): Env['NODE_ENV'] {
    return this.nestConfigService.get('NODE_ENV');
  }

  get port(): Env['PORT'] {
    return this.nestConfigService.get('PORT');
  }

  // Investment quotes (spec 104)
  get brapiToken(): Env['BRAPI_TOKEN'] {
    return this.nestConfigService.get('BRAPI_TOKEN');
  }

  get finnhubToken(): Env['FINNHUB_TOKEN'] {
    return this.nestConfigService.get('FINNHUB_TOKEN');
  }

  get investmentQuoteRefreshCooldownMs(): Env['INVESTMENT_QUOTE_REFRESH_COOLDOWN_MS'] {
    return this.nestConfigService.get('INVESTMENT_QUOTE_REFRESH_COOLDOWN_MS');
  }

  get investmentQuotesBrapiBatchSize(): Env['INVESTMENT_QUOTES_BRAPI_BATCH_SIZE'] {
    return this.nestConfigService.get('INVESTMENT_QUOTES_BRAPI_BATCH_SIZE');
  }

  get investmentQuotesJobEnabled(): Env['INVESTMENT_QUOTES_JOB_ENABLED'] {
    return this.nestConfigService.get('INVESTMENT_QUOTES_JOB_ENABLED');
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

  get dbPoolConnectionTimeoutMs(): Env['DB_POOL_CONNECTION_TIMEOUT_MS'] {
    return this.nestConfigService.get('DB_POOL_CONNECTION_TIMEOUT_MS');
  }

  get dbPoolIdleTimeoutMs(): Env['DB_POOL_IDLE_TIMEOUT_MS'] {
    return this.nestConfigService.get('DB_POOL_IDLE_TIMEOUT_MS');
  }

  get dbPoolMax(): Env['DB_POOL_MAX'] {
    return this.nestConfigService.get('DB_POOL_MAX');
  }

  get dbPort(): Env['DB_PORT'] {
    return this.nestConfigService.get('DB_PORT');
  }

  get dbStatementTimeoutMs(): Env['DB_STATEMENT_TIMEOUT_MS'] {
    return this.nestConfigService.get('DB_STATEMENT_TIMEOUT_MS');
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

  // Perf

  get perfCountQueries(): Env['PERF_COUNT_QUERIES'] {
    return this.nestConfigService.get('PERF_COUNT_QUERIES');
  }

  // Monitoring (spec 106)
  get sentryDsn(): Env['SENTRY_DSN'] {
    return this.nestConfigService.get('SENTRY_DSN');
  }

  get sentryEnabled(): Env['SENTRY_ENABLED'] {
    return this.nestConfigService.get('SENTRY_ENABLED');
  }

  get sentryEnvironment(): Env['SENTRY_ENVIRONMENT'] {
    return this.nestConfigService.get('SENTRY_ENVIRONMENT');
  }

  get sentryTracesSampleRate(): Env['SENTRY_TRACES_SAMPLE_RATE'] {
    return this.nestConfigService.get('SENTRY_TRACES_SAMPLE_RATE');
  }

  // Sessions

  get sessionIdleTtlSeconds(): Env['SESSION_IDLE_TTL_SECONDS'] {
    return this.nestConfigService.get('SESSION_IDLE_TTL_SECONDS');
  }

  // Versions

  get githubToken(): Env['GITHUB_TOKEN'] {
    return this.nestConfigService.get('GITHUB_TOKEN');
  }

  get versionCheckTtlSeconds(): Env['VERSION_CHECK_TTL_SECONDS'] {
    return this.nestConfigService.get('VERSION_CHECK_TTL_SECONDS');
  }

  get versionRepoApi(): Env['VERSION_REPO_API'] {
    return this.nestConfigService.get('VERSION_REPO_API');
  }

  get versionRepoApp(): Env['VERSION_REPO_APP'] {
    return this.nestConfigService.get('VERSION_REPO_APP');
  }

  // Finance

  get financeMaterializationGateTtlMs(): Env['FINANCE_MATERIALIZATION_GATE_TTL_MS'] {
    return this.nestConfigService.get('FINANCE_MATERIALIZATION_GATE_TTL_MS');
  }

  // Docs

  get swaggerEnabled(): Env['SWAGGER_ENABLED'] {
    return this.nestConfigService.get('SWAGGER_ENABLED');
  }
}
