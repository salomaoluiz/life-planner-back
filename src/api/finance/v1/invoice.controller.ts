import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Request,
} from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';
import { z } from 'zod';

import {
  InvoiceDetailOutput,
  InvoiceMonthParamSchema,
  InvoicePaymentOutput,
  InvoicesForListOutput,
  PayInvoiceApiSchema,
  PayInvoiceBody,
} from '@api/finance/v1/dto/invoice.dto';
import {
  OwnerIdQuerySchema,
  TodayQuerySchema,
  toOwnerIds,
  toTransactionFilter,
  TransactionFilterQueryFields,
  withPeriodRules,
} from '@api/finance/v1/finance-query';
import { InvoiceService } from '@api/finance/v1/invoice.service';
import { JwtPayload } from '@shared/infra/jwt/types';
import { validate } from '@shared/infra/validation';

// Exactly one of `month` or `from`+`to` (spec 045); `accountId` is accepted but means nothing to card rows.
const ListInvoicesQuerySchema = withPeriodRules(
  z
    .object({
      ...TransactionFilterQueryFields,
      month: InvoiceMonthParamSchema.optional(),
      ownerId: OwnerIdQuerySchema,
    })
    .extend(TodayQuerySchema.shape),
).refine((value) => (value.month === undefined) !== (value.from === undefined), {
  message: 'Send either month or from and to',
});

// Registered BEFORE CreditCardController (see FinanceAPIModule): `invoices` must not match its `:id` route.
@ApiBearerAuth('JWT')
@Controller({
  path: 'finance/credit-cards',
  version: '1',
})
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @ApiNoContentResponse()
  @Delete(':id/invoices/:month/payment')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deletePayment(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('month') month: string,
  ) {
    await this.invoiceService.undo(req.user.id, id, validate(InvoiceMonthParamSchema, month));
  }

  @Get('invoices')
  @ZodResponse({ status: 200, type: InvoicesForListOutput })
  async findAllForList(
    @Request() req: JwtPayload & Request,
    @Query() query: Record<string, unknown>,
  ) {
    const { month, ownerId, today, ...filterQuery } = validate(ListInvoicesQuerySchema, query);

    return this.invoiceService.findForList(
      req.user.id,
      month,
      toOwnerIds(ownerId),
      today,
      toTransactionFilter(filterQuery),
    );
  }

  @Get(':id/invoices/:month')
  @ZodResponse({ status: 200, type: InvoiceDetailOutput })
  async findOne(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('month') month: string,
    @Query() query: Record<string, unknown>,
  ) {
    const { today } = validate(TodayQuerySchema, query);

    return this.invoiceService.findOne(
      req.user.id,
      id,
      validate(InvoiceMonthParamSchema, month),
      today,
    );
  }

  @Post(':id/invoices/:month/payment')
  @ZodResponse({ status: 201, type: InvoicePaymentOutput })
  async pay(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('month') month: string,
    @Body() body: PayInvoiceBody,
    @Query() query: Record<string, unknown>,
  ) {
    const input = validate(PayInvoiceApiSchema, body);
    const { today } = validate(TodayQuerySchema, query);

    return this.invoiceService.pay(
      req.user.id,
      id,
      validate(InvoiceMonthParamSchema, month),
      input,
      today,
    );
  }
}
