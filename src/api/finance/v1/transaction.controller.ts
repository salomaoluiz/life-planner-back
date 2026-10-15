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
  CreateTransactionApiSchema,
  CreateTransactionBody,
  TransactionOutput,
  UpdateTransactionApiSchema,
  UpdateTransactionBody,
} from '@api/finance/v1/dto/transaction.dto';
import { OwnerIdQuerySchema, TodayQuerySchema, toOwnerIds } from '@api/finance/v1/finance-query';
import { TransactionService } from '@api/finance/v1/transaction.service';
import { InvoiceMonthSchema } from '@finance/application/dto/FinanceCommon';
import { TransactionSource } from '@finance/domain/enum';
import { JwtPayload } from '@shared/infra/jwt/types';
import { validate } from '@shared/infra/validation';

// Default source ACCOUNT keeps old app versions working: they never see a row without an account.
const ListTransactionsQuerySchema = z.object({
  creditCardId: z.uuid().optional(),
  invoiceMonth: InvoiceMonthSchema.optional(),
  ownerId: OwnerIdQuerySchema,
  source: z.enum(TransactionSource).optional(),
});

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
  async delete(@Request() req: JwtPayload & Request, @Param('id', ParseUUIDPipe) id: string) {
    await this.transactionService.delete(req.user.id, id);
  }

  @Get()
  @ZodResponse({ status: 200, type: [TransactionOutput] })
  async findAll(@Request() req: JwtPayload & Request, @Query() query: Record<string, unknown>) {
    const { ownerId, ...filter } = validate(ListTransactionsQuerySchema, query);

    return this.transactionService.findAll(req.user.id, toOwnerIds(ownerId), filter);
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
