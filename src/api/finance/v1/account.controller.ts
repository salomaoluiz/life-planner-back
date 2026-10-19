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

import { AccountService } from '@api/finance/v1/account.service';
import {
  AccountOutput,
  AdjustAccountBalanceApiSchema,
  AdjustAccountBalanceBody,
  CreateAccountApiSchema,
  CreateAccountBody,
  DailyBalancesOutput,
  DailyBalancesQuerySchema,
  UpdateAccountApiSchema,
  UpdateAccountBody,
} from '@api/finance/v1/dto/account.dto';
import {
  OwnerIdQuerySchema,
  resolveToday,
  TodayQuerySchema,
  toOwnerIds,
} from '@api/finance/v1/finance-query';
import { JwtPayload } from '@shared/infra/jwt/types';
import { validate } from '@shared/infra/validation';

const ListAccountsQuerySchema = TodayQuerySchema.extend({ ownerId: OwnerIdQuerySchema });

const DailyBalancesRequestSchema = ListAccountsQuerySchema.extend(DailyBalancesQuerySchema.shape);

@ApiBearerAuth('JWT')
@Controller({
  path: 'finance/accounts',
  version: '1',
})
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @HttpCode(HttpStatus.OK)
  @Post(':id/balance-adjustment')
  @ZodResponse({ status: 200, type: AccountOutput })
  async adjustBalance(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: Record<string, unknown>,
    @Body() body: AdjustAccountBalanceBody,
  ) {
    const { today } = validate(TodayQuerySchema, query);
    const input = validate(AdjustAccountBalanceApiSchema, body);

    return this.accountService.adjustBalance(req.user.id, id, input.balance, resolveToday(today));
  }

  @Post()
  @ZodResponse({ status: 201, type: AccountOutput })
  async create(@Request() req: JwtPayload & Request, @Body() body: CreateAccountBody) {
    const input = validate(CreateAccountApiSchema, body);

    return this.accountService.create(req.user.id, input, resolveToday());
  }

  @ApiNoContentResponse()
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Request() req: JwtPayload & Request, @Param('id', ParseUUIDPipe) id: string) {
    await this.accountService.delete(req.user.id, id);
  }

  // Declared before every `:id` route.
  @Get('daily-balances')
  @ZodResponse({ status: 200, type: DailyBalancesOutput })
  async dailyBalances(
    @Request() req: JwtPayload & Request,
    @Query() query: Record<string, unknown>,
  ) {
    const { month, ownerId, today } = validate(DailyBalancesRequestSchema, query);

    return this.accountService.getDailyBalances(
      req.user.id,
      toOwnerIds(ownerId),
      month,
      resolveToday(today),
    );
  }

  @Get()
  @ZodResponse({ status: 200, type: [AccountOutput] })
  async findAll(@Request() req: JwtPayload & Request, @Query() query: Record<string, unknown>) {
    const { ownerId, today } = validate(ListAccountsQuerySchema, query);

    return this.accountService.findAll(req.user.id, toOwnerIds(ownerId), resolveToday(today));
  }

  @Patch(':id')
  @ZodResponse({ status: 200, type: AccountOutput })
  async update(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateAccountBody,
  ) {
    const input = validate(UpdateAccountApiSchema, body);

    return this.accountService.update(req.user.id, id, input, resolveToday());
  }
}
