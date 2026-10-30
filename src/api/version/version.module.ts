import { Module } from '@nestjs/common';

import { VersionController } from '@api/version/v1/version.controller';
import { VersionService } from '@api/version/v1/version.service';
import { VersionModule } from '@version/version.module';

@Module({
  controllers: [VersionController],
  imports: [VersionModule],
  providers: [VersionService],
})
export class VersionAPIModule {}
