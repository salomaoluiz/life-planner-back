import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { ApiModule } from '@api/api.module';
import { SharedModule } from '@shared/shared.module';

@Module({
  imports: [ConfigModule.forRoot(), ApiModule, SharedModule],
})
export class AppModule {}
