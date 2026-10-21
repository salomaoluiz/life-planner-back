import { Controller, Get, Query, Request } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';
import { z } from 'zod';

import { DashboardRequest, DashboardService } from '@api/finance/v1/dashboard.service';
import {
  BalanceSeriesOutput,
  BalanceSeriesQuerySchema,
  DashboardSummaryOutput,
  DashboardSummaryQuerySchema,
  TotalsOutput,
  TotalsQuerySchema,
} from '@api/finance/v1/dto/dashboard.dto';
import { resolveToday, toOwnerIds } from '@api/finance/v1/finance-query';
import { JwtPayload } from '@shared/infra/jwt/types';
import { validate } from '@shared/infra/validation';

type CommonQuery = z.infer<typeof DashboardSummaryQuerySchema>;

function toRequest(query: CommonQuery): DashboardRequest {
  return {
    currency: query.currency,
    filter: {
      accountIds: toOwnerIds(query.accountId),
      categoryIds: toOwnerIds(query.categoryId),
      creditCardIds: toOwnerIds(query.creditCardId),
      paid: query.paid === undefined ? undefined : query.paid === 'true',
      q: query.q === '' ? undefined : query.q,
      source: query.source,
      tagIds: toOwnerIds(query.tagId),
    },
    from: query.from,
    ownerIds: toOwnerIds(query.ownerId),
    to: query.to,
    today: resolveToday(query.today),
  };
}

@ApiBearerAuth('JWT')
@Controller({
  path: 'finance/dashboard',
  version: '1',
})
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('balance-series')
  @ZodResponse({ status: 200, type: BalanceSeriesOutput })
  async balanceSeries(
    @Request() req: JwtPayload & Request,
    @Query() query: Record<string, unknown>,
  ) {
    const { granularity, ...common } = validate(BalanceSeriesQuerySchema, query);
    return this.dashboardService.getBalanceSeries(req.user.id, toRequest(common), granularity);
  }

  @Get('summary')
  @ZodResponse({ status: 200, type: DashboardSummaryOutput })
  async summary(@Request() req: JwtPayload & Request, @Query() query: Record<string, unknown>) {
    const common = validate(DashboardSummaryQuerySchema, query);
    return this.dashboardService.getSummary(req.user.id, toRequest(common));
  }

  @Get('totals')
  @ZodResponse({ status: 200, type: TotalsOutput })
  async totals(@Request() req: JwtPayload & Request, @Query() query: Record<string, unknown>) {
    const { groupBy, parentId, type, ...common } = validate(TotalsQuerySchema, query);
    return this.dashboardService.getTotals(req.user.id, toRequest(common), {
      groupBy,
      parentId,
      type,
    });
  }
}
