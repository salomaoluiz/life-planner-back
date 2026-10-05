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

import { AccountService } from '@api/finance/v1/account.service';
import {
  AccountOutput,
  CreateAccountApiSchema,
  CreateAccountBody,
  UpdateAccountApiSchema,
  UpdateAccountBody,
} from '@api/finance/v1/dto/account.dto';
import { OwnerIdQuerySchema, toOwnerIds } from '@api/finance/v1/finance-query';
import { JwtPayload } from '@shared/infra/jwt/types';
import { validate } from '@shared/infra/validation';

const ListAccountsQuerySchema = z.object({ ownerId: OwnerIdQuerySchema });

@ApiBearerAuth('JWT')
@Controller({
  path: 'finance/accounts',
  version: '1',
})
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Post()
  @ZodResponse({ status: 201, type: AccountOutput })
  async create(@Request() req: JwtPayload & Request, @Body() body: CreateAccountBody) {
    const input = validate(CreateAccountApiSchema, body);

    return this.accountService.create(req.user.id, input);
  }

  @ApiNoContentResponse()
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Request() req: JwtPayload & Request, @Param('id', ParseUUIDPipe) id: string) {
    await this.accountService.delete(req.user.id, id);
  }

  @Get()
  @ZodResponse({ status: 200, type: [AccountOutput] })
  async findAll(@Request() req: JwtPayload & Request, @Query() query: Record<string, unknown>) {
    const { ownerId } = validate(ListAccountsQuerySchema, query);

    return this.accountService.findAll(req.user.id, toOwnerIds(ownerId));
  }

  @Patch(':id')
  @ZodResponse({ status: 200, type: AccountOutput })
  async update(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateAccountBody,
  ) {
    const input = validate(UpdateAccountApiSchema, body);

    return this.accountService.update(req.user.id, id, input);
  }
}
