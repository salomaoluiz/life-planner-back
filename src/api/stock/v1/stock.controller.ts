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
  Query,
  Request,
} from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';
import { z } from 'zod';

import {
  CreateStockItemApiSchema,
  CreateStockItemBody,
  StockItemOutput,
  UpdateStockItemApiSchema,
  UpdateStockItemBody,
} from '@api/stock/v1/dto/stock.dto';
import { StockService } from '@api/stock/v1/stock.service';
import { JwtPayload } from '@shared/infra/jwt/types';
import { validate } from '@shared/infra/validation';

const ListStockItemsQuerySchema = z.object({ ownerId: z.uuid().optional() });

@ApiBearerAuth('JWT')
@Controller({
  path: 'stock/items',
  version: '1',
})
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Post()
  @ZodResponse({ status: 201, type: StockItemOutput })
  async create(@Request() req: JwtPayload & Request, @Body() body: CreateStockItemBody) {
    const input = validate(CreateStockItemApiSchema, body);

    return this.stockService.create(req.user.id, input);
  }

  @ApiNoContentResponse()
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Request() req: JwtPayload & Request, @Param('id', ParseUUIDPipe) id: string) {
    await this.stockService.delete(req.user.id, id);
  }

  @Get()
  @ZodResponse({ status: 200, type: [StockItemOutput] })
  async findAll(@Request() req: JwtPayload & Request, @Query() query: Record<string, unknown>) {
    const { ownerId } = validate(ListStockItemsQuerySchema, query);

    return this.stockService.findAll(req.user.id, ownerId);
  }

  @Get(':id')
  @ZodResponse({ status: 200, type: StockItemOutput })
  async findById(@Request() req: JwtPayload & Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.stockService.findById(req.user.id, id);
  }

  @Patch(':id')
  @ZodResponse({ status: 200, type: StockItemOutput })
  async update(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateStockItemBody,
  ) {
    const input = validate(UpdateStockItemApiSchema, body);

    return this.stockService.update(req.user.id, id, input);
  }
}
