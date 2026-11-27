import { Body, Controller, Get, Header, Post, Query, Request, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiProduces } from '@nestjs/swagger';
import { createZodDto, ZodResponse } from 'nestjs-zod';

import { ActivityAction, ActivityEntityType } from '@activity/domain/enum';
import { DeferredJson, RecordsActivity } from '@api/activity/ActivityRecorder';
import { importGroup, importOwnerKey } from '@api/activity/descriptors';
import {
  ExportCountOutputSchema,
  ExportCountQuerySchema,
  ExportQuerySchema,
  ImportTransactionsApiSchema,
  ImportTransactionsBody,
} from '@api/finance/v1/dto/transaction-csv.dto';
import { TodayQuerySchema } from '@api/finance/v1/finance-query';
import { TransactionCsvService } from '@api/finance/v1/transaction-csv.service';
import { HttpResponse } from '@shared/infra/http/request-context';
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

  // Dry run → 200 `{ errors, duplicates }`; for real → 201 `{ created }` (422 `{ errors }` writes nothing).
  // The status depends on the body, so the response is written here (Nest would overwrite a passthrough status).
  @Post('import')
  @RecordsActivity({
    action: ActivityAction.CREATE,
    entityType: ActivityEntityType.TRANSACTION_IMPORT,
    group: importGroup,
    idFrom: importOwnerKey,
    skipWhen: (context) => (context.body as { dryRun?: boolean }).dryRun === true,
  })
  async import(
    @Request() req: JwtPayload & Request,
    @Body() body: ImportTransactionsBody,
    @Query() query: Record<string, unknown>,
    // Library mode: the response is sent by the activity interceptor once the import and its entry have committed.
    @Res() response: HttpResponse,
  ): Promise<DeferredJson> {
    // Money data is never cached (the global interceptor only sets this header on handlers that return normally).
    response.setHeader('Cache-Control', 'private, no-cache');

    const input = validate(ImportTransactionsApiSchema, body);
    const { today } = validate(TodayQuerySchema, query);
    const result = await this.transactionCsvService.import(req.user.id, input, today);

    if (input.dryRun) {
      return new DeferredJson(200, {
        duplicates: result.duplicates,
        errors: result.errors,
        invoices: result.invoices,
      });
    }

    return new DeferredJson(201, { created: result.created });
  }
}
