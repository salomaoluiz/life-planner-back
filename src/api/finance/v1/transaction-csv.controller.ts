import { Controller, Get, Header, Query, Request, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiProduces } from '@nestjs/swagger';
import { createZodDto, ZodResponse } from 'nestjs-zod';

import {
  ExportCountOutputSchema,
  ExportCountQuerySchema,
  ExportQuerySchema,
} from '@api/finance/v1/dto/transaction-csv.dto';
import { TransactionCsvService } from '@api/finance/v1/transaction-csv.service';
import { JwtPayload } from '@shared/infra/jwt/types';
import { validate } from '@shared/infra/validation';

class ExportCountOutput extends createZodDto(ExportCountOutputSchema) {}

@ApiBearerAuth('JWT')
@Controller({
  path: 'finance/transactions',
  version: '1',
})
export class TransactionCsvController {
  constructor(private readonly transactionCsvService: TransactionCsvService) {}

  @ApiProduces('text/csv')
  @Get('export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async export(
    @Request() req: JwtPayload & Request,
    @Query() query: Record<string, unknown>,
    @Res({ passthrough: true }) res: { setHeader(name: string, value: string): void },
  ): Promise<string> {
    const input = validate(ExportQuerySchema, query);
    const { csv, filename } = await this.transactionCsvService.export(req.user.id, input);

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    return csv;
  }

  @Get('export/count')
  @ZodResponse({ status: 200, type: ExportCountOutput })
  async exportCount(@Request() req: JwtPayload & Request, @Query() query: Record<string, unknown>) {
    const input = validate(ExportCountQuerySchema, query);

    return this.transactionCsvService.count(req.user.id, input);
  }
}
