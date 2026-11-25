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

  // Embeddings (spec 116)
  get embeddingsApiKey(): Env['EMBEDDINGS_API_KEY'] {
    return this.nestConfigService.get('EMBEDDINGS_API_KEY');
  }

  get embeddingsApiUrl(): Env['EMBEDDINGS_API_URL'] {
    return this.nestConfigService.get('EMBEDDINGS_API_URL');
  }

  get embeddingsDimensions(): Env['EMBEDDINGS_DIMENSIONS'] {
    return this.nestConfigService.get('EMBEDDINGS_DIMENSIONS');
  }

  get embeddingsModel(): Env['EMBEDDINGS_MODEL'] {
    return this.nestConfigService.get('EMBEDDINGS_MODEL');
  }

  // LLM and Open Food Facts (spec 121)
  get googleAiApiKey(): Env['GOOGLE_AI_API_KEY'] {
    return this.nestConfigService.get('GOOGLE_AI_API_KEY');
  }

  get googleAiApiUrl(): Env['GOOGLE_AI_API_URL'] {
    return this.nestConfigService.get('GOOGLE_AI_API_URL');
  }

  get googleAiSearchModel(): Env['GOOGLE_AI_SEARCH_MODEL'] {
    return this.nestConfigService.get('GOOGLE_AI_SEARCH_MODEL');
  }

  get llmApiKey(): Env['LLM_API_KEY'] {
    return this.nestConfigService.get('LLM_API_KEY');
  }

  get llmApiUrl(): Env['LLM_API_URL'] {
    return this.nestConfigService.get('LLM_API_URL');
  }

  get llmDailyLightLimit(): Env['LLM_DAILY_LIGHT_LIMIT'] {
    return this.nestConfigService.get('LLM_DAILY_LIGHT_LIMIT');
  }

  get llmDailySearchLimit(): Env['LLM_DAILY_SEARCH_LIMIT'] {
    return this.nestConfigService.get('LLM_DAILY_SEARCH_LIMIT');
  }

  get llmModelLight(): Env['LLM_MODEL_LIGHT'] {
    return this.nestConfigService.get('LLM_MODEL_LIGHT');
  }

  get llmModelSearch(): Env['LLM_MODEL_SEARCH'] {
    return this.nestConfigService.get('LLM_MODEL_SEARCH');
  }

  get llmTimeoutLightMs(): Env['LLM_TIMEOUT_LIGHT_MS'] {
    return this.nestConfigService.get('LLM_TIMEOUT_LIGHT_MS');
  }

  get llmTimeoutSearchMs(): Env['LLM_TIMEOUT_SEARCH_MS'] {
    return this.nestConfigService.get('LLM_TIMEOUT_SEARCH_MS');
  }

  get llmUsageTimezone(): Env['LLM_USAGE_TIMEZONE'] {
    return this.nestConfigService.get('LLM_USAGE_TIMEZONE');
  }

  get openFoodFactsTimeoutMs(): Env['OPEN_FOOD_FACTS_TIMEOUT_MS'] {
    return this.nestConfigService.get('OPEN_FOOD_FACTS_TIMEOUT_MS');
  }

  get openFoodFactsUrl(): Env['OPEN_FOOD_FACTS_URL'] {
    return this.nestConfigService.get('OPEN_FOOD_FACTS_URL');
  }

  get openFoodFactsUserAgent(): Env['OPEN_FOOD_FACTS_USER_AGENT'] {
    return this.nestConfigService.get('OPEN_FOOD_FACTS_USER_AGENT');
  }

  // Investment quotes (spec 104)
  get brapiToken(): Env['BRAPI_TOKEN'] {
    return this.nestConfigService.get('BRAPI_TOKEN');
  }

  get finnhubToken(): Env['FINNHUB_TOKEN'] {
    return this.nestConfigService.get('FINNHUB_TOKEN');
  }

  get investmentIncomeSeriesJobEnabled(): Env['INVESTMENT_INCOME_SERIES_JOB_ENABLED'] {
    return this.nestConfigService.get('INVESTMENT_INCOME_SERIES_JOB_ENABLED');
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

  get investmentQuotesMinIntervalMs(): Env['INVESTMENT_QUOTES_MIN_INTERVAL_MS'] {
    return this.nestConfigService.get('INVESTMENT_QUOTES_MIN_INTERVAL_MS');
  }

  get marketIndexJobEnabled(): Env['MARKET_INDEX_JOB_ENABLED'] {
    return this.nestConfigService.get('MARKET_INDEX_JOB_ENABLED');
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

  // Stock

  get stockForecastGateTtlMs(): Env['STOCK_FORECAST_GATE_TTL_MS'] {
    return this.nestConfigService.get('STOCK_FORECAST_GATE_TTL_MS');
  }

  // Docs

  get swaggerEnabled(): Env['SWAGGER_ENABLED'] {
    return this.nestConfigService.get('SWAGGER_ENABLED');
  }
}
