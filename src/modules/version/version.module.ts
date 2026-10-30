import { Module } from '@nestjs/common';

import { GetVersionInfoUseCase } from '@version/application/use-case/GetVersionInfoUseCase';

@Module({
  exports: [GetVersionInfoUseCase],
  providers: [GetVersionInfoUseCase],
})
export class VersionModule {}
