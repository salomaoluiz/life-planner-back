import { Controller, Get, Query, Request } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';

import { MonthOutput, MonthQuerySchema } from '@api/finance/v1/dto/month.dto';
import { toOwnerIds, toTransactionFilter } from '@api/finance/v1/finance-query';
import { MonthService } from '@api/finance/v1/month.service';
import { JwtPayload } from '@shared/infra/jwt/types';
import { validate } from '@shared/infra/validation';

// Spec 080: everything the transactions screen shows for one month, in one round trip.
@ApiBearerAuth('JWT')
@Controller({
  path: 'finance/month',
  version: '1',
})
export class MonthController {
  constructor(private readonly monthService: MonthService) {}

  @Get()
  @ZodResponse({ status: 200, type: MonthOutput })
  async find(@Request() req: JwtPayload & Request, @Query() query: Record<string, unknown>) {
    const { month, ownerId, today, ...filterQuery } = validate(MonthQuerySchema, query);

    return this.monthService.find(
      req.user.id,
      month,
      toOwnerIds(ownerId),
      toTransactionFilter(filterQuery),
      today,
    );
  }
}
