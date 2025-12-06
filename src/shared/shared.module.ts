import { Global, Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';

import { EnvModule } from './infra/env/env.module';
import { AllExceptionsFilter } from './infra/http/filters/all-exception-filter';
import { Logger } from './infra/logger';

@Global()
@Module({
  exports: ['ILogger', 'IJwtProvider'],
  imports: [EnvModule],
  providers: [
    { provide: 'ILogger', useClass: Logger },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class SharedModule {}
