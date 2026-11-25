import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Request,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';

import {
  AiUsageOutput,
  BarcodeLookupOutput,
  BarcodeParamSchema,
  BarcodeQuerySchema,
  SuggestionBody,
  SuggestionBodySchema,
  SuggestionOutput,
} from '@api/stock/v1/dto/barcode.dto';
import { StockBarcodeService } from '@api/stock/v1/stockBarcode.service';
import { JwtPayload } from '@shared/infra/jwt/types';
import { validate } from '@shared/infra/validation';

@ApiBearerAuth('JWT')
@Controller({
  path: 'stock/barcodes',
  version: '1',
})
export class StockBarcodeController {
  constructor(private readonly barcodeService: StockBarcodeService) {}

  @Get(':code')
  @ZodResponse({ status: 200, type: BarcodeLookupOutput })
  async lookup(
    @Request() req: JwtPayload & Request,
    @Param() params: Record<string, unknown>,
    @Query() query: Record<string, unknown>,
  ) {
    const { code } = validate(BarcodeParamSchema, params);
    const { today } = validate(BarcodeQuerySchema, query);

    return this.barcodeService.findByBarcode(req.user.id, code, today);
  }
}

@ApiBearerAuth('JWT')
@Controller({
  path: 'stock/item-suggestions',
  version: '1',
})
export class StockItemSuggestionController {
  constructor(private readonly barcodeService: StockBarcodeService) {}

  @HttpCode(HttpStatus.OK)
  @Post()
  @ZodResponse({ status: 200, type: SuggestionOutput })
  async suggest(@Request() req: JwtPayload & Request, @Body() body: SuggestionBody) {
    return this.barcodeService.suggest(req.user.id, validate(SuggestionBodySchema, body));
  }

  @Get('usage')
  @ZodResponse({ status: 200, type: AiUsageOutput })
  async usage(@Request() req: JwtPayload & Request) {
    return this.barcodeService.getUsage(req.user.id);
  }
}
