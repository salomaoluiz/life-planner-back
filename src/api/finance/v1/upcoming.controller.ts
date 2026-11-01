import { Controller, Get, Query, Request } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';

import { UpcomingOutput, UpcomingQuerySchema } from '@api/finance/v1/dto/upcoming.dto';
import { resolveToday, toOwnerIds } from '@api/finance/v1/finance-query';
import { UpcomingService } from '@api/finance/v1/upcoming.service';
import { JwtPayload } from '@shared/infra/jwt/types';
import { validate } from '@shared/infra/validation';

@ApiBearerAuth('JWT')
@Controller({
  path: 'finance/upcoming',
  version: '1',
})
export class UpcomingController {
  constructor(private readonly upcomingService: UpcomingService) {}

  @Get()
  @ZodResponse({ status: 200, type: UpcomingOutput })
  async upcoming(@Request() req: JwtPayload & Request, @Query() query: Record<string, unknown>) {
    const { days, limit, ownerId, today } = validate(UpcomingQuerySchema, query);

    return this.upcomingService.getUpcoming(req.user.id, {
      days,
      limit,
      ownerIds: toOwnerIds(ownerId) as string[],
      today: resolveToday(today),
    });
  }
}
