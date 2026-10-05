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
import { OwnerIdQuerySchema, toOwnerIds } from '@api/finance/v1/finance-query';
import { TransactionService } from '@api/finance/v1/transaction.service';
import { JwtPayload } from '@shared/infra/jwt/types';
import { validate } from '@shared/infra/validation';

const ListTransactionsQuerySchema = z.object({ ownerId: OwnerIdQuerySchema });

@ApiBearerAuth('JWT')
@Controller({
  path: 'finance/transactions',
  version: '1',
})
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  @Post()
  @ZodResponse({ status: 201, type: TransactionOutput })
  async create(@Request() req: JwtPayload & Request, @Body() body: CreateTransactionBody) {
    const input = validate(CreateTransactionApiSchema, body);

    return this.transactionService.create(req.user.id, input);
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
    const { ownerId } = validate(ListTransactionsQuerySchema, query);

    return this.transactionService.findAll(req.user.id, toOwnerIds(ownerId));
  }

  @Patch(':id')
  @ZodResponse({ status: 200, type: TransactionOutput })
  async update(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateTransactionBody,
  ) {
    const input = validate(UpdateTransactionApiSchema, body);

    return this.transactionService.update(req.user.id, id, input);
  }
}
