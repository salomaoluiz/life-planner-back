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
  ConsumptionWeeksOutput,
  CreateStockItemApiSchema,
  CreateStockItemBody,
  CreateStockMovementApiSchema,
  CreateStockMovementBody,
  DayQuerySchema,
  FrequentQuerySchema,
  GestureExpirationApiSchema,
  GestureExpirationBody,
  IdempotencyKeySchema,
  ListStockItemsQuerySchema,
  MovementsQuerySchema,
  OwnerChangePreviewOutput,
  OwnerChangePreviewQuerySchema,
  StockFrequentOutput,
  StockItemOutput,
  StockItemResultOutput,
  StockListItemOutput,
  StockMovementPageOutput,
  StockMovementResultOutput,
  StockSuggestionOutput,
  SuggestionsQuerySchema,
  UndoGestureApiSchema,
  UndoGestureBody,
  UpdateStockItemApiSchema,
  UpdateStockItemBody,
  WasteOutput,
  WasteQuerySchema,
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

  @Get(':id/consumption-weeks')
  @ZodResponse({ status: 200, type: ConsumptionWeeksOutput })
  async findConsumptionWeeks(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: Record<string, unknown>,
  ) {
    const { today } = validate(DayQuerySchema, query);

    return this.stockService.findConsumptionWeeks(req.user.id, id, today);
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

// Registered before StockController: "frequent" must never be read as an item id (spec 117 FR 28).
@ApiBearerAuth('JWT')
@Controller({
  path: 'stock/items/frequent',
  version: '1',
})
export class StockFrequentController {
  constructor(private readonly stockService: StockService) {}

  @Get()
  @ZodResponse({ status: 200, type: StockFrequentOutput })
  async frequent(@Request() req: JwtPayload & Request, @Query() query: Record<string, unknown>) {
    return this.stockService.findFrequent(req.user.id, validate(FrequentQuerySchema, query));
  }
}

// Spec 123 FR 29-31: the Waste screen of one month (no owner = every readable owner, archived families hidden).
@ApiBearerAuth('JWT')
@Controller({
  path: 'stock/waste',
  version: '1',
})
export class StockWasteController {
  constructor(private readonly stockService: StockService) {}

  @Get()
  @ZodResponse({ status: 200, type: WasteOutput })
  async find(@Request() req: JwtPayload & Request, @Query() query: Record<string, unknown>) {
    const filters = validate(WasteQuerySchema, query);

    return this.stockService.findWaste(req.user.id, filters);
  }
}

// Spec 123 FR 25: the leftover warning of a lot can be dismissed (204) and the dismissal undone (204).
@ApiBearerAuth('JWT')
@Controller({
  path: 'stock/lots',
  version: '1',
})
export class StockLotController {
  constructor(private readonly stockService: StockService) {}

  @ApiNoContentResponse()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post(':id/leftover-dismissal')
  async dismiss(@Request() req: JwtPayload & Request, @Param('id', ParseUUIDPipe) id: string) {
    await this.stockService.dismissLeftover(req.user.id, id, true);
  }

  @ApiNoContentResponse()
  @Delete(':id/leftover-dismissal')
  @HttpCode(HttpStatus.NO_CONTENT)
  async undoDismissal(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.stockService.dismissLeftover(req.user.id, id, false);
  }
}

// Spec 117 FR 26-27: a gesture is the group of movements of one quick tap series.
@ApiBearerAuth('JWT')
@Controller({
  path: 'stock/movements',
  version: '1',
})
export class StockGestureController {
  constructor(private readonly stockService: StockService) {}

  @HttpCode(HttpStatus.OK)
  @Post(':gestureId/expiration')
  @ZodResponse({ status: 200, type: StockItemResultOutput })
  async expiration(
    @Request() req: JwtPayload & Request,
    @Param('gestureId', ParseUUIDPipe) gestureId: string,
    @Body() body: GestureExpirationBody,
  ) {
    const input = validate(GestureExpirationApiSchema, body);

    return this.stockService.setGestureExpiration(req.user.id, gestureId, input);
  }

  @HttpCode(HttpStatus.OK)
  @Post('undo')
  @ZodResponse({ status: 200, type: StockItemResultOutput })
  async undo(@Request() req: JwtPayload & Request, @Body() body: UndoGestureBody) {
    const { gestureId } = validate(UndoGestureApiSchema, body);

    return this.stockService.undoGesture(req.user.id, gestureId);
  }
}
