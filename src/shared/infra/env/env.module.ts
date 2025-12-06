import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';

import { validateEnvironment } from './env.schema';
import { EnvService } from './env.service';

@Module({
  exports: [EnvService],
  imports: [
    NestConfigModule.forRoot({
      cache: true,
      isGlobal: true,
      validate: validateEnvironment,
    }),
  ],
  providers: [EnvService],
})
export class EnvModule {}
