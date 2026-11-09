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
  Request,
} from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';

import {
  CreateTransferApiSchema,
  CreateTransferBody,
  TransferWithRowsOutput,
  UpdateTransferApiSchema,
  UpdateTransferBody,
} from '@api/finance/v1/dto/transfer.dto';
import { FinanceEtag } from '@api/finance/v1/finance-etag';
import { TransferService } from '@api/finance/v1/transfer.service';
import { JwtPayload } from '@shared/infra/jwt/types';
import { validate } from '@shared/infra/validation';

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
  async create(@Request() req: JwtPayload & Request, @Body() body: CreateTransferBody) {
    return this.transferService.create(req.user.id, validate(CreateTransferApiSchema, body));
  }

  @ApiNoContentResponse()
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Request() req: JwtPayload & Request, @Param('id', ParseUUIDPipe) id: string) {
    await this.transferService.delete(req.user.id, id);
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
