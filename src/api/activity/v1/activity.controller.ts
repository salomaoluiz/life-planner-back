import { Controller, Get, Param, Query, Request } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';

import { ActivityService } from '@api/activity/v1/activity.service';
import {
  ActivityIdParamSchema,
  ActivityItemsOutput,
  ActivityItemsQuerySchema,
  ActivityListOutput,
  ActivityListQuerySchema,
} from '@api/activity/v1/dto/activity.dto';
import { JwtPayload } from '@shared/infra/jwt/types';
import { validate } from '@shared/infra/validation';

// Spec 127 section 7: read-only. Entries are written by the write routes themselves (`@RecordsActivity`).
@ApiBearerAuth('JWT')
@Controller({
  path: 'activity',
  version: '1',
})
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Get()
  @ZodResponse({ status: 200, type: ActivityListOutput })
  async list(@Request() req: JwtPayload & Request, @Query() query: Record<string, unknown>) {
    return this.activityService.list(req.user.id, validate(ActivityListQuerySchema, query));
  }

  @Get(':id/items')
  @ZodResponse({ status: 200, type: ActivityItemsOutput })
  async listItems(
    @Request() req: JwtPayload & Request,
    @Param() params: Record<string, unknown>,
    @Query() query: Record<string, unknown>,
  ) {
    const { id } = validate(ActivityIdParamSchema, params);

    return this.activityService.listItems(
      req.user.id,
      id,
      validate(ActivityItemsQuerySchema, query),
    );
  }
}
