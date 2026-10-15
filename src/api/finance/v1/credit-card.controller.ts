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

import { CreditCardService } from '@api/finance/v1/credit-card.service';
import {
  CreateCreditCardApiSchema,
  CreateCreditCardBody,
  CreditCardOutput,
  CreditCardsOverviewOutput,
  UpdateCreditCardApiSchema,
  UpdateCreditCardBody,
} from '@api/finance/v1/dto/credit-card.dto';
import { OwnerIdQuerySchema, toOwnerIds } from '@api/finance/v1/finance-query';
import { AccountStatus } from '@finance/domain/enum';
import { JwtPayload } from '@shared/infra/jwt/types';
import { validate } from '@shared/infra/validation';

const ListCreditCardsQuerySchema = z.object({
  ownerId: OwnerIdQuerySchema,
  status: z.enum(AccountStatus).optional(),
});
const OverviewQuerySchema = z.object({ ownerId: OwnerIdQuerySchema });

@ApiBearerAuth('JWT')
@Controller({
  path: 'finance/credit-cards',
  version: '1',
})
export class CreditCardController {
  constructor(private readonly creditCardService: CreditCardService) {}

  @Post()
  @ZodResponse({ status: 201, type: CreditCardOutput })
  async create(@Request() req: JwtPayload & Request, @Body() body: CreateCreditCardBody) {
    const input = validate(CreateCreditCardApiSchema, body);

    return this.creditCardService.create(req.user.id, input);
  }

  @ApiNoContentResponse()
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Request() req: JwtPayload & Request, @Param('id', ParseUUIDPipe) id: string) {
    await this.creditCardService.delete(req.user.id, id);
  }

  @Get()
  @ZodResponse({ status: 200, type: [CreditCardOutput] })
  async findAll(@Request() req: JwtPayload & Request, @Query() query: Record<string, unknown>) {
    const { ownerId, status } = validate(ListCreditCardsQuerySchema, query);

    return this.creditCardService.findAll(req.user.id, toOwnerIds(ownerId), status);
  }

  // Named so it sorts before `findOne` (lint keeps methods alphabetical): Nest registers routes in method order, and `overview` must not match `:id`.
  @Get('overview')
  @ZodResponse({ status: 200, type: CreditCardsOverviewOutput })
  async findAllOverview(
    @Request() req: JwtPayload & Request,
    @Query() query: Record<string, unknown>,
  ) {
    const { ownerId } = validate(OverviewQuerySchema, query);

    return this.creditCardService.findOverview(req.user.id, toOwnerIds(ownerId));
  }

  @Get(':id')
  @ZodResponse({ status: 200, type: CreditCardOutput })
  async findOne(@Request() req: JwtPayload & Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.creditCardService.findOne(req.user.id, id);
  }

  @Patch(':id')
  @ZodResponse({ status: 200, type: CreditCardOutput })
  async update(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateCreditCardBody,
  ) {
    const input = validate(UpdateCreditCardApiSchema, body);

    return this.creditCardService.update(req.user.id, id, input);
  }
}
