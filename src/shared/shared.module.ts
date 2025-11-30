import { Global, Module } from '@nestjs/common';

import { Logger } from './infra/logger';

@Global()
@Module({
  exports: ['ILogger'],
  providers: [{ provide: 'ILogger', useClass: Logger }],
})
export class SharedModule {}
