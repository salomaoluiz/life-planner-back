import { Injectable } from '@nestjs/common';

import { VersionOutput } from '@api/version/v1/dto/version.dto';
import { GetVersionInfoUseCase } from '@version/application/use-case/GetVersionInfoUseCase';

@Injectable()
export class VersionService {
  constructor(private readonly getVersionInfo: GetVersionInfoUseCase) {}

  async get(refresh: boolean): Promise<VersionOutput> {
    return this.getVersionInfo.execute({ refresh });
  }
}
