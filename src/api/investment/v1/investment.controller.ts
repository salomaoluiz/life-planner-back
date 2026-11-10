import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Request,
} from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';

import {
  AssetDetailOutput,
  AssetItemOutput,
  AssetListOutput,
  CreateAssetApiSchema,
  CreateAssetBody,
  CreateOperationApiSchema,
  CreateOperationBody,
  ListAssetsQuerySchema,
  OperationWriteOutput,
  PriceHistoryOutput,
  PriceHistoryQuerySchema,
  RefreshQuotesApiSchema,
  RefreshQuotesBody,
  RefreshQuotesOutput,
  TickerSearchOutput,
  TickerSearchQuerySchema,
  UpdateAssetApiSchema,
  UpdateAssetBody,
  UpdateOperationApiSchema,
  UpdateOperationBody,
  UpsertValuationApiSchema,
  UpsertValuationBody,
  ValuationDateParamSchema,
  ValuationWriteOutput,
} from '@api/investment/v1/dto/investment.dto';
import { InvestmentService } from '@api/investment/v1/investment.service';
import { JwtPayload } from '@shared/infra/jwt/types';
import { validate } from '@shared/infra/validation';

@ApiBearerAuth('JWT')
@Controller({
  path: 'investments',
  version: '1',
})
export class InvestmentController {
  constructor(private readonly investmentService: InvestmentService) {}

  @Post('assets')
  @ZodResponse({ status: 201, type: AssetItemOutput })
  async createAsset(@Request() req: JwtPayload & Request, @Body() body: CreateAssetBody) {
    return this.investmentService.createAsset(req.user.id, validate(CreateAssetApiSchema, body));
  }

  @Post('assets/:id/operations')
  @ZodResponse({ status: 201, type: OperationWriteOutput })
  async createOperation(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CreateOperationBody,
  ) {
    return this.investmentService.createOperation(
      req.user.id,
      id,
      validate(CreateOperationApiSchema, body),
    );
  }

  @ApiNoContentResponse()
  @Delete('assets/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAsset(@Request() req: JwtPayload & Request, @Param('id', ParseUUIDPipe) id: string) {
    await this.investmentService.deleteAsset(req.user.id, id);
  }

  @ApiNoContentResponse()
  @Delete('operations/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteOperation(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.investmentService.deleteOperation(req.user.id, id);
  }

  @ApiNoContentResponse()
  @Delete('valuations/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteValuation(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.investmentService.deleteValuation(req.user.id, id);
  }

  @Get('assets/:id')
  @ZodResponse({ status: 200, type: AssetDetailOutput })
  async findAssetById(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.investmentService.findAssetById(req.user.id, id);
  }

  @Get('assets')
  @ZodResponse({ status: 200, type: AssetListOutput })
  async findAssets(@Request() req: JwtPayload & Request, @Query() query: Record<string, unknown>) {
    return this.investmentService.findAssets(req.user.id, validate(ListAssetsQuerySchema, query));
  }

  @Get('assets/:id/price-history')
  @ZodResponse({ status: 200, type: PriceHistoryOutput })
  async priceHistory(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: Record<string, unknown>,
  ) {
    return this.investmentService.priceHistory(
      req.user.id,
      id,
      validate(PriceHistoryQuerySchema, query).range,
    );
  }

  @HttpCode(HttpStatus.OK)
  @Post('quotes/refresh')
  @ZodResponse({ status: 200, type: RefreshQuotesOutput })
  async refreshQuotes(@Request() req: JwtPayload & Request, @Body() body: RefreshQuotesBody) {
    return this.investmentService.refreshQuotes(
      req.user.id,
      validate(RefreshQuotesApiSchema, body ?? {}).assetIds,
    );
  }

  @Get('tickers/search')
  @ZodResponse({ status: 200, type: TickerSearchOutput })
  async searchTickers(@Query() query: Record<string, unknown>) {
    return this.investmentService.searchTickers(validate(TickerSearchQuerySchema, query));
  }

  @Patch('assets/:id')
  @ZodResponse({ status: 200, type: AssetItemOutput })
  async updateAsset(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateAssetBody,
  ) {
    return this.investmentService.updateAsset(
      req.user.id,
      id,
      validate(UpdateAssetApiSchema, body),
    );
  }

  @Patch('operations/:id')
  @ZodResponse({ status: 200, type: OperationWriteOutput })
  async updateOperation(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateOperationBody,
  ) {
    return this.investmentService.updateOperation(
      req.user.id,
      id,
      validate(UpdateOperationApiSchema, body),
    );
  }

  @Put('assets/:id/valuations/:date')
  @ZodResponse({ status: 200, type: ValuationWriteOutput })
  async upsertValuation(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('date') date: string,
    @Body() body: UpsertValuationBody,
  ) {
    return this.investmentService.upsertValuation(
      req.user.id,
      id,
      validate(ValuationDateParamSchema, date),
      validate(UpsertValuationApiSchema, body),
    );
  }
}
