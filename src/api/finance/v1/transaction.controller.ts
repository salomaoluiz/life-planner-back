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

import { CalendarDateApiSchema } from '@api/finance/v1/dto/finance-fields';
import {
  CreateTransactionApiSchema,
  CreateTransactionBody,
  TransactionOutput,
  TransactionPageOutput,
  UpdateTransactionApiSchema,
  UpdateTransactionBody,
} from '@api/finance/v1/dto/transaction.dto';
import {
  OwnerIdQuerySchema,
  TodayQuerySchema,
  toOwnerIds,
  toTransactionFilter,
  TransactionFilterQueryFields,
  withPeriodRules,
} from '@api/finance/v1/finance-query';
import { TransactionService } from '@api/finance/v1/transaction.service';
import { InvoiceMonthSchema } from '@finance/application/dto/FinanceCommon';
import { InstallmentEditScope, TransactionSource } from '@finance/domain/enum';
import {
  decodeTransactionCursor,
  TRANSACTION_PAGE_DEFAULT_LIMIT,
  TRANSACTION_PAGE_MAX_LIMIT,
} from '@finance/domain/service/TransactionCursor';
import { JwtPayload } from '@shared/infra/jwt/types';
import { validate } from '@shared/infra/validation';

// Spec 078: the list needs a period (`from` + `to`), or a card invoice month, and comes in keyset pages.
const ListTransactionsQuerySchema = withPeriodRules(
  z.object({
    ...TransactionFilterQueryFields,
    cursor: z
      .string()
      .refine((value) => decodeTransactionCursor(value) !== undefined, {
        message: 'cursor is not valid',
      })
      .optional(),
    invoiceMonth: InvoiceMonthSchema.optional(),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(TRANSACTION_PAGE_MAX_LIMIT)
      .default(TRANSACTION_PAGE_DEFAULT_LIMIT),
    ownerId: OwnerIdQuerySchema,
    source: z.enum(TransactionSource).optional(),
    today: CalendarDateApiSchema.optional(),
  }),
).refine(
  (value) =>
    (value.from !== undefined && value.to !== undefined) ||
    (value.source === TransactionSource.CARD && value.invoiceMonth !== undefined),
  { message: 'from and to are required (or source CARD with invoiceMonth)' },
);

// `scope` is required (ONLY_THIS) to delete one occurrence of a recurring series (spec 034 FR 29).
const DeleteTransactionQuerySchema = z.object({ scope: z.enum(InstallmentEditScope).optional() });

@ApiBearerAuth('JWT')
@Controller({
  path: 'finance/transactions',
  version: '1',
})
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  @Post()
  @ZodResponse({ status: 201, type: TransactionOutput })
  async create(
    @Request() req: JwtPayload & Request,
    @Body() body: CreateTransactionBody,
    @Query() query: Record<string, unknown>,
  ) {
    const input = validate(CreateTransactionApiSchema, body);
    const { today } = validate(TodayQuerySchema, query);

    return this.transactionService.create(req.user.id, input, today);
  }

  @ApiNoContentResponse()
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: Record<string, unknown>,
  ) {
    const { scope } = validate(DeleteTransactionQuerySchema, query);

    await this.transactionService.delete(req.user.id, id, scope);
  }

  @Get()
  @ZodResponse({ status: 200, type: TransactionPageOutput })
  async findAll(@Request() req: JwtPayload & Request, @Query() query: Record<string, unknown>) {
    const { cursor, invoiceMonth, limit, ownerId, source, today, ...filterQuery } = validate(
      ListTransactionsQuerySchema,
      query,
    );

    return this.transactionService.findAll(
      req.user.id,
      toOwnerIds(ownerId),
      { cursor, filter: toTransactionFilter(filterQuery), invoiceMonth, limit, source },
      today,
    );
  }

  @Get(':id')
  @ZodResponse({ status: 200, type: TransactionOutput })
  async findById(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: Record<string, unknown>,
  ) {
    const { today } = validate(TodayQuerySchema, query);

    return this.transactionService.findById(req.user.id, id, today);
  }

  @Patch(':id')
  @ZodResponse({ status: 200, type: TransactionOutput })
  async update(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateTransactionBody,
    @Query() query: Record<string, unknown>,
  ) {
    const input = validate(UpdateTransactionApiSchema, body);
    const { today } = validate(TodayQuerySchema, query);

    return this.transactionService.update(req.user.id, id, input, today);
  }
}
