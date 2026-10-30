import { Controller, Get, Query } from '@nestjs/common';
import { ZodResponse } from 'nestjs-zod';

import { VersionOutput, VersionQuerySchema } from '@api/version/v1/dto/version.dto';
import { VersionService } from '@api/version/v1/version.service';
import { Public } from '@shared/infra/http/decorators/Public';
import { validate } from '@shared/infra/validation';

@Controller({
  path: 'version',
  version: '1',
})
export class VersionController {
  constructor(private readonly versionService: VersionService) {}

  @Get()
  @Public()
  @ZodResponse({ status: 200, type: VersionOutput })
  async get(@Query() query: Record<string, unknown>) {
    const { refresh } = validate(VersionQuerySchema, query);

    return this.versionService.get(refresh === 'true');
  }
}
