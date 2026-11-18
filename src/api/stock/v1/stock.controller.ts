import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
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

import {
  CreateStockItemApiSchema,
  CreateStockItemBody,
  CreateStockMovementApiSchema,
  CreateStockMovementBody,
  DayQuerySchema,
  IdempotencyKeySchema,
  ListStockItemsQuerySchema,
  MovementsQuerySchema,
  OwnerChangePreviewOutput,
  OwnerChangePreviewQuerySchema,
  StockItemOutput,
  StockListItemOutput,
  StockMovementPageOutput,
  StockMovementResultOutput,
  StockSuggestionOutput,
  SuggestionsQuerySchema,
  UpdateStockItemApiSchema,
  UpdateStockItemBody,
} from '@api/stock/v1/dto/stock.dto';
import { StockService } from '@api/stock/v1/stock.service';
import { JwtPayload } from '@shared/infra/jwt/types';
import { validate } from '@shared/infra/validation';

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

  @Post(':id/movements')
  @ZodResponse({ status: 201, type: StockMovementResultOutput })
  async createMovement(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CreateStockMovementBody,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    const input = validate(CreateStockMovementApiSchema, body);
    const clientId = validate(IdempotencyKeySchema, idempotencyKey);

    return this.stockService.createMovement(req.user.id, id, input, clientId);
  }

  @ApiNoContentResponse()
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Request() req: JwtPayload & Request, @Param('id', ParseUUIDPipe) id: string) {
    await this.stockService.delete(req.user.id, id);
  }

  @Get()
  @ZodResponse({ status: 200, type: [StockListItemOutput] })
  async findAll(@Request() req: JwtPayload & Request, @Query() query: Record<string, unknown>) {
    const filters = validate(ListStockItemsQuerySchema, query);

    return this.stockService.findAll(req.user.id, filters);
  }

  @Get(':id')
  @ZodResponse({ status: 200, type: StockItemOutput })
  async findById(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: Record<string, unknown>,
  ) {
    const { today } = validate(DayQuerySchema, query);

    return this.stockService.findById(req.user.id, id, today);
  }

  @Get(':id/movements')
  @ZodResponse({ status: 200, type: StockMovementPageOutput })
  async findMovements(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: Record<string, unknown>,
  ) {
    const { cursor } = validate(MovementsQuerySchema, query);

    return this.stockService.findMovements(req.user.id, id, cursor);
  }

  @Get(':id/owner-change-preview')
  @ZodResponse({ status: 200, type: OwnerChangePreviewOutput })
  async ownerChangePreview(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: Record<string, unknown>,
  ) {
    const { owner, ownerId } = validate(OwnerChangePreviewQuerySchema, query);

    return this.stockService.ownerChangePreview(req.user.id, id, owner, ownerId);
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

// Its own controller, registered before StockController: "suggestions" must never be read as an item id.
@ApiBearerAuth('JWT')
@Controller({
  path: 'stock/items/suggestions',
  version: '1',
})
export class StockSuggestionController {
  constructor(private readonly stockService: StockService) {}

  @Get()
  @ZodResponse({ status: 200, type: StockSuggestionOutput })
  async suggest(@Request() req: JwtPayload & Request, @Query() query: Record<string, unknown>) {
    return this.stockService.suggest(req.user.id, validate(SuggestionsQuerySchema, query));
  }
}
