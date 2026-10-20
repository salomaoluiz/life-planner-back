import { Controller, Get, Query, Request } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';

import {
  ProjectedOccurrenceOutput,
  ProjectionsQuerySchema,
} from '@api/finance/v1/dto/recurrence.dto';
import { toOwnerIds, toTransactionFilter } from '@api/finance/v1/finance-query';
import { RecurrenceService } from '@api/finance/v1/recurrence.service';
import { JwtPayload } from '@shared/infra/jwt/types';
import { validate } from '@shared/infra/validation';

// Its own controller, registered BEFORE RecurrenceController: the `:id` route there would otherwise take
// `/recurrences/projections` (the lint rules keep methods in alphabetical order, so ordering by method is not possible).
@ApiBearerAuth('JWT')
@Controller({
  path: 'finance/recurrences/projections',
  version: '1',
})
export class RecurrenceProjectionController {
  constructor(private readonly recurrenceService: RecurrenceService) {}

  @Get()
  @ZodResponse({ status: 200, type: [ProjectedOccurrenceOutput] })
  async findAll(@Request() req: JwtPayload & Request, @Query() query: Record<string, unknown>) {
    const { from, ownerId, to, today, ...filterQuery } = validate(ProjectionsQuerySchema, query);

    return this.recurrenceService.findProjections(
      req.user.id,
      { from, to },
      toOwnerIds(ownerId),
      today,
      toTransactionFilter(filterQuery),
    );
  }
}
