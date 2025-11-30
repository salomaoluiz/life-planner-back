import { Global, Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';

import { AllExceptionsFilter } from '@shared/infra/http/filters/all-exception-filter';

import { Logger } from './infra/logger';

@Global()
@Module({
  exports: ['ILogger'],
  providers: [
    { provide: 'ILogger', useClass: Logger },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class SharedModule {}
