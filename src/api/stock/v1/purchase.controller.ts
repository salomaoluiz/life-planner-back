import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Request,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';

import {
  ClosedPurchaseOutput,
  ClosePreviewOutput,
  ClosePreviewQuerySchema,
  ClosePurchaseApiSchema,
  ClosePurchaseBody,
  ClosingLockOutput,
  CreateMarketApiSchema,
  CreateMarketBody,
  DeletedPurchaseOutput,
  ItemPricesOutput,
  ListPurchasesOutput,
  ListPurchasesQuerySchema,
  MarketOutput,
  MarketsOutput,
  MarketsQuerySchema,
  PendingPurchasesOutput,
  PricesQuerySchema,
  PurchaseHeaderOutput,
  PurchaseRowResultOutput,
  PurchaseViewOutput,
  StartPurchaseApiSchema,
  StartPurchaseBody,
  UpdateClosedPurchaseApiSchema,
  UpdateClosedPurchaseBody,
  UpdateMarketApiSchema,
  UpdateMarketBody,
  UpsertPurchaseRowApiSchema,
  UpsertPurchaseRowBody,
} from '@api/stock/v1/dto/purchase.dto';
import { PurchaseService } from '@api/stock/v1/purchase.service';
import { listLanguageOf } from '@api/stock/v1/shoppingList.controller';
import { JwtPayload } from '@shared/infra/jwt/types';
import { INotifier } from '@shared/infra/notifier/types';
import { validate } from '@shared/infra/validation';

const KEY_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface EventResponse {
  end: () => void;
  flushHeaders?: () => void;
  on: (event: string, handler: () => void) => unknown;
  setHeader: (name: string, value: string) => unknown;
  write: (chunk: string) => unknown;
}
// `Idempotency-Key` (spec 117 FR 21) is a UUID the client generates per write; anything else is ignored.
function keyOf(header?: string): string | undefined {
  return header && KEY_PATTERN.test(header) ? header : undefined;
}

@ApiBearerAuth('JWT')
@Controller({ path: 'stock/markets', version: '1' })
export class MarketController {
  constructor(private readonly purchaseService: PurchaseService) {}

  @Post()
  @ZodResponse({ status: 201, type: MarketOutput })
  async create(@Request() req: JwtPayload & Request, @Body() body: CreateMarketBody) {
    return this.purchaseService.createMarket(req.user.id, validate(CreateMarketApiSchema, body));
  }

  @Get()
  @ZodResponse({ type: MarketsOutput })
  async findAll(@Request() req: JwtPayload & Request, @Query() query: Record<string, string>) {
    return this.purchaseService.findMarkets(req.user.id, validate(MarketsQuerySchema, query));
  }

  @Patch(':id')
  @ZodResponse({ type: MarketOutput })
  async update(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateMarketBody,
  ) {
    return this.purchaseService.updateMarket(
      req.user.id,
      id,
      validate(UpdateMarketApiSchema, body),
    );
  }
}
// `GET stock/purchases/pending` lives in its own controller, registered before `PurchaseController`, so it is
// never read as `:id`.
@ApiBearerAuth('JWT')
@Controller({ path: 'stock/purchases/pending', version: '1' })
export class PendingPurchaseController {
  constructor(private readonly purchaseService: PurchaseService) {}

  @Get()
  @ZodResponse({ type: PendingPurchasesOutput })
  async pending(@Request() req: JwtPayload & Request) {
    return this.purchaseService.pending(req.user.id);
  }
}
@ApiBearerAuth('JWT')
@Controller({ path: 'stock/purchases', version: '1' })
export class PurchaseController {
  constructor(private readonly purchaseService: PurchaseService) {}

  @HttpCode(HttpStatus.OK)
  @Post(':id/close')
  @ZodResponse({ type: ClosedPurchaseOutput })
  async close(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ClosePurchaseBody,
    @Headers('accept-language') language?: string,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.purchaseService.close(
      req.user.id,
      id,
      validate(ClosePurchaseApiSchema, body),
      listLanguageOf(language),
      keyOf(key),
    );
  }

  @Get(':id/close-preview')
  @ZodResponse({ type: ClosePreviewOutput })
  async closePreview(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: Record<string, string>,
  ) {
    const { receiptTotalCents } = validate(ClosePreviewQuerySchema, query);
    return this.purchaseService.closePreview(req.user.id, id, receiptTotalCents);
  }

  @HttpCode(HttpStatus.OK)
  @Post(':id/closing')
  @ZodResponse({ type: ClosingLockOutput })
  async closing(@Request() req: JwtPayload & Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.purchaseService.closingLock(req.user.id, id, false);
  }

  @ApiNoContentResponse()
  @Delete(':id/closing')
  @HttpCode(HttpStatus.NO_CONTENT)
  async closingRelease(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.purchaseService.closingLock(req.user.id, id, true);
  }

  @Post()
  @ZodResponse({ status: 201, type: PurchaseHeaderOutput })
  async create(
    @Request() req: JwtPayload & Request,
    @Body() body: StartPurchaseBody,
    @Res({ passthrough: true }) response: { status: (code: number) => unknown },
  ) {
    const result = await this.purchaseService.start(
      req.user.id,
      validate(StartPurchaseApiSchema, body),
    );
    if (!result.created) {
      response.status(HttpStatus.OK);
    }
    return result.purchase;
  }

  @HttpCode(HttpStatus.OK)
  @Post(':id/discard')
  @ZodResponse({ type: PurchaseHeaderOutput })
  async discard(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.purchaseService.changeStatus(req.user.id, id, 'DISCARD', keyOf(key));
  }

  @HttpCode(HttpStatus.OK)
  @Post(':id/end')
  @ZodResponse({ type: PurchaseHeaderOutput })
  async end(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.purchaseService.changeStatus(req.user.id, id, 'END', keyOf(key));
  }

  @Get(':id')
  @ZodResponse({ type: PurchaseViewOutput })
  async findById(@Request() req: JwtPayload & Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.purchaseService.findPurchase(req.user.id, id);
  }

  @HttpCode(HttpStatus.OK)
  @Post(':id/merge-into/:targetId')
  @ZodResponse({ type: PurchaseHeaderOutput })
  async merge(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('targetId', ParseUUIDPipe) targetId: string,
  ) {
    return this.purchaseService.merge(req.user.id, id, targetId);
  }

  @Delete(':id')
  @ZodResponse({ type: DeletedPurchaseOutput })
  async remove(@Request() req: JwtPayload & Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.purchaseService.deleteClosed(req.user.id, id);
  }

  @ApiNoContentResponse()
  @Delete(':id/rows/:rowId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeRow(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('rowId', ParseUUIDPipe) rowId: string,
    @Headers('idempotency-key') key?: string,
  ): Promise<void> {
    await this.purchaseService.removeRow(req.user.id, id, rowId, keyOf(key));
  }

  @HttpCode(HttpStatus.OK)
  @Post(':id/reopen')
  @ZodResponse({ type: PurchaseHeaderOutput })
  async reopen(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.purchaseService.changeStatus(req.user.id, id, 'REOPEN', keyOf(key));
  }

  @Patch(':id')
  @ZodResponse({ type: PurchaseHeaderOutput })
  async update(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateClosedPurchaseBody,
  ) {
    const result = await this.purchaseService.updateClosed(
      req.user.id,
      id,
      validate(UpdateClosedPurchaseApiSchema, body),
    );
    return result.purchase;
  }

  @Put(':id/rows/:rowId')
  @ZodResponse({ type: PurchaseRowResultOutput })
  async upsertRow(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('rowId', ParseUUIDPipe) rowId: string,
    @Body() body: UpsertPurchaseRowBody,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.purchaseService.upsertRow(
      req.user.id,
      id,
      rowId,
      validate(UpsertPurchaseRowApiSchema, body),
      keyOf(key),
    );
  }
}
@ApiBearerAuth('JWT')
@Controller({ path: 'stock/shopping-lists/:id/purchases', version: '1' })
export class ListPurchaseController {
  constructor(private readonly purchaseService: PurchaseService) {}

  @Get()
  @ZodResponse({ type: ListPurchasesOutput })
  async findAll(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: Record<string, string>,
  ) {
    return this.purchaseService.listPurchases(
      req.user.id,
      id,
      validate(ListPurchasesQuerySchema, query),
    );
  }
}
@ApiBearerAuth('JWT')
@Controller({ path: 'stock/items/:id/prices', version: '1' })
export class ItemPriceController {
  constructor(private readonly purchaseService: PurchaseService) {}

  @Get()
  @ZodResponse({ type: ItemPricesOutput })
  async prices(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: Record<string, string>,
  ) {
    return this.purchaseService.itemPrices(req.user.id, id, validate(PricesQuerySchema, query));
  }
}

const HEARTBEAT_MS = 25_000;
const STREAM_MAX_MS = 30 * 60 * 1000;
const ACCESS_CHECK_MS = 5 * 60 * 1000;
const CHANNEL = 'stock_list_events';

// Spec 120 FR 23-25: the shopping mode of a list follows its purchases through Server-Sent Events. Events carry
// the changed row in the REST shape; `Last-Event-ID` replays what was missed.
@ApiBearerAuth('JWT')
@Controller({ path: 'stock/shopping-lists/:id/events', version: '1' })
export class PurchaseEventsController {
  constructor(
    @Inject('INotifier') private readonly notifier: INotifier,
    private readonly purchaseService: PurchaseService,
  ) {}

  @Get()
  async stream(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) listId: string,
    @Res() response: EventResponse,
    @Headers('last-event-id') lastEventId?: string,
  ): Promise<void> {
    const userId = req.user.id;
    let last = /^\d+$/.test(lastEventId ?? '') ? BigInt(lastEventId as string) : undefined;
    // 404 for a list the caller cannot read, before any header is written.
    const missed = await this.purchaseService.events(userId, listId, last ?? 0n);

    response.setHeader('Content-Type', 'text/event-stream');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('X-Accel-Buffering', 'no');
    response.flushHeaders?.();

    function send(events: Awaited<ReturnType<PurchaseService['events']>>) {
      for (const event of events) {
        response.write(
          `id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify({ payload: event.payload, purchaseId: event.purchaseId })}\n\n`,
        );
        last = event.id;
      }
    }

    if (last !== undefined) {
      // A full replay page means events were left out: the client does a conditional GET instead (FR 25).
      if (missed.length >= 500) {
        response.write('event: resync\ndata: {}\n\n');
        last = missed[missed.length - 1].id;
      } else {
        send(missed);
      }
    } else {
      // A fresh stream only follows what comes next: skip to the latest stored event.
      let page = missed;

      while (page.length > 0) {
        last = page[page.length - 1].id;
        page = page.length >= 500 ? await this.purchaseService.events(userId, listId, last) : [];
      }
    }

    const flush = async () => {
      send(await this.purchaseService.events(userId, listId, last ?? 0n));
    };
    const stop = await this.notifier.subscribe(CHANNEL, (payload) => {
      try {
        if ((JSON.parse(payload) as { listId: string }).listId === listId) {
          void flush().catch(() => undefined);
        }
      } catch {
        // A malformed notification is ignored.
      }
    });
    const heartbeat = setInterval(() => response.write(': ping\n\n'), HEARTBEAT_MS);
    // The user may lose access while the stream is open: re-checked every 5 minutes.
    const recheck = setInterval(() => {
      void this.purchaseService.events(userId, listId, last ?? 0n).catch(() => close());
    }, ACCESS_CHECK_MS);
    const limit = setTimeout(() => close(), STREAM_MAX_MS);

    function close() {
      clearInterval(heartbeat);
      clearInterval(recheck);
      clearTimeout(limit);
      stop();
      response.end();
    }

    response.on('close', () => {
      clearInterval(heartbeat);
      clearInterval(recheck);
      clearTimeout(limit);
      stop();
    });
  }
}
