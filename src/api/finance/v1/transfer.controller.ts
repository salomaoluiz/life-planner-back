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
  CreateTransferApiSchema,
  CreateTransferBody,
  TransferWithRowsOutput,
  UpdateTransferApiSchema,
  UpdateTransferBody,
} from '@api/finance/v1/dto/transfer.dto';
import { FinanceEtag } from '@api/finance/v1/finance-etag';
import { TodayQuerySchema } from '@api/finance/v1/finance-query';
import { TransferService } from '@api/finance/v1/transfer.service';
import { InstallmentEditScope } from '@finance/domain/enum';
import { JwtPayload } from '@shared/infra/jwt/types';
import { validate } from '@shared/infra/validation';

// `scope` is required (ONLY_THIS or THIS_AND_NEXT) to delete an occurrence of a series (spec 034 FR 29).
const DeleteTransferQuerySchema = z.object({ scope: z.enum(InstallmentEditScope).optional() });

// Spec 098: one movement between two accounts; its rows are listed through `/finance/transactions`.
@ApiBearerAuth('JWT')
@Controller({
  path: 'finance/transfers',
  version: '1',
})
@FinanceEtag()
export class TransferController {
  constructor(private readonly transferService: TransferService) {}

  @Post()
  @ZodResponse({ status: 201, type: TransferWithRowsOutput })
  async create(
    @Request() req: JwtPayload & Request,
    @Body() body: CreateTransferBody,
    @Query() query: Record<string, unknown>,
  ) {
    const { today } = validate(TodayQuerySchema, query);

    return this.transferService.create(req.user.id, validate(CreateTransferApiSchema, body), today);
  }

  @ApiNoContentResponse()
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: Record<string, unknown>,
  ) {
    const { scope } = validate(DeleteTransferQuerySchema, query);

    await this.transferService.delete(req.user.id, id, scope);
  }

  @Get(':id')
  @ZodResponse({ status: 200, type: TransferWithRowsOutput })
  async findById(@Request() req: JwtPayload & Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.transferService.findById(req.user.id, id);
  }

  @Patch(':id')
  @ZodResponse({ status: 200, type: TransferWithRowsOutput })
  async update(
    @Request() req: JwtPayload & Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateTransferBody,
  ) {
    return this.transferService.update(req.user.id, id, validate(UpdateTransferApiSchema, body));
  }
}
