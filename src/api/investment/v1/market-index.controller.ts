import { Controller, Get, HttpCode, HttpStatus, Param, Post, Query, Request } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';

import {
  MarketIndexesOutput,
  MarketIndexHistoryOutput,
  MarketIndexHistoryQuerySchema,
  MarketIndexParamSchema,
} from '@api/investment/v1/dto/market-index.dto';
import { MarketIndexService } from '@api/investment/v1/market-index.service';
import { JwtPayload } from '@shared/infra/jwt/types';
import { validate } from '@shared/infra/validation';

// Spec 113: CDI, Selic and IPCA from the Central Bank, global data read by every authenticated user. GET answers are
// `private, no-cache` (the global interceptor) and revalidate through the automatic ETag.
@ApiBearerAuth('JWT')
@Controller({
  path: 'investments/market-indexes',
  version: '1',
})
export class MarketIndexController {
  constructor(private readonly marketIndexService: MarketIndexService) {}

  @Get(':index/history')
  @ZodResponse({ status: 200, type: MarketIndexHistoryOutput })
  async history(
    @Request() req: JwtPayload & Request,
    @Param() params: Record<string, unknown>,
    @Query() query: Record<string, unknown>,
  ) {
    const { index } = validate(MarketIndexParamSchema, params);
    const { from, to } = validate(MarketIndexHistoryQuerySchema, query);

    return this.marketIndexService.getHistory(req.user.id, index, from, to);
  }

  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  @ZodResponse({ status: 200, type: MarketIndexesOutput })
  async refresh(@Request() req: JwtPayload & Request) {
    return this.marketIndexService.refresh(req.user.id);
  }

  @Get()
  @ZodResponse({ status: 200, type: MarketIndexesOutput })
  async summary(@Request() req: JwtPayload & Request) {
    return this.marketIndexService.getSummary(req.user.id);
  }
}
